/**
 * Catálogo slot — Fase 1: todas las rutas requieren admin (LICENSE_ADMIN_EMAILS).
 */
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const { uploadCatalogImageBuffer, removeCatalogObjectByPublicUrl } = require('../lib/catalogImageStorage');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function escapeIlikePattern(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function normalizeReference(ref) {
  return String(ref ?? '')
    .trim()
    .toUpperCase();
}

function parseOptionalDate(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/** Tipo de vehículo (misma semántica que vehicles.type). */
function parseOptionalVehicleType(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

function adminGuard(req, res, next) {
  if (!assertLicenseAdmin(req, res)) return;
  next();
}

router.use(authMiddleware);
router.use(adminGuard);

/**
 * GET /search?q=
 */
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 1) {
      return res.json({ items: [] });
    }
    const pattern = `%${escapeIlikePattern(q)}%`;
    const sel = 'id, reference, manufacturer, model_name, vehicle_type, commercial_release_date, image_url';
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('slot_catalog_items').select(sel).ilike('reference', pattern).limit(20),
      supabase.from('slot_catalog_items').select(sel).ilike('manufacturer', pattern).limit(20),
      supabase.from('slot_catalog_items').select(sel).ilike('model_name', pattern).limit(20),
      supabase.from('slot_catalog_items').select(sel).ilike('vehicle_type', pattern).limit(20),
    ]);
    if (r1.error) return res.status(500).json({ error: r1.error.message });
    if (r2.error) return res.status(500).json({ error: r2.error.message });
    if (r3.error) return res.status(500).json({ error: r3.error.message });
    if (r4.error) return res.status(500).json({ error: r4.error.message });
    const byId = new Map();
    for (const row of [...(r1.data || []), ...(r2.data || []), ...(r3.data || []), ...(r4.data || [])]) {
      byId.set(row.id, row);
    }
    const items = Array.from(byId.values()).slice(0, 20);
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /my-requests — propuestas del usuario actual (admin en Fase 1 también puede consultar las suyas)
 */
router.get('/my-requests', async (req, res) => {
  try {
    const uid = req.user.id;
    const [chg, ins] = await Promise.all([
      supabase
        .from('slot_catalog_change_requests')
        .select('id, catalog_item_id, status, proposed_patch, created_at, reviewed_at, rejection_reason')
        .eq('submitted_by', uid)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('slot_catalog_insert_requests')
        .select(
          'id, proposed_reference, proposed_manufacturer, proposed_model_name, proposed_vehicle_type, proposed_commercial_release_date, status, created_at, reviewed_at, rejection_reason, created_catalog_item_id',
        )
        .eq('submitted_by', uid)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (chg.error) return res.status(500).json({ error: chg.error.message });
    if (ins.error) return res.status(500).json({ error: ins.error.message });
    res.json({
      change_requests: chg.data ?? [],
      insert_requests: ins.data ?? [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /items — paginación
 */
router.get('/items', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const refFilter = String(req.query.reference ?? '').trim();
    const mfgFilter = String(req.query.manufacturer ?? '').trim();

    let q = supabase.from('slot_catalog_items').select('*', { count: 'exact' });
    if (refFilter) {
      const p = `%${escapeIlikePattern(refFilter)}%`;
      q = q.ilike('reference', p);
    }
    if (mfgFilter) {
      const p = `%${escapeIlikePattern(mfgFilter)}%`;
      q = q.ilike('manufacturer', p);
    }
    q = q.order('reference', { ascending: true }).range(from, to);

    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({
      items: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: count != null ? Math.ceil(count / limit) : 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /items/:id
 */
router.get('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('slot_catalog_items').select('*').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Ítem no encontrado' });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const itemUpload = upload.fields([{ name: 'image', maxCount: 1 }]);

/**
 * POST /items
 */
router.post('/items', itemUpload, async (req, res) => {
  try {
    const reference = normalizeReference(req.body.reference);
    const manufacturer = String(req.body.manufacturer ?? '').trim();
    const model_name = String(req.body.model_name ?? '').trim();
    const vehicle_type = parseOptionalVehicleType(req.body.vehicle_type);
    const commercial_release_date = parseOptionalDate(req.body.commercial_release_date);

    if (!reference || !manufacturer || !model_name) {
      return res.status(400).json({ error: 'reference, manufacturer y model_name son obligatorios' });
    }

    let image_url = null;
    const img = req.files?.image?.[0];
    if (img) {
      try {
        image_url = await uploadCatalogImageBuffer(supabase, img.buffer, img.mimetype);
      } catch (e) {
        return res.status(400).json({ error: e.message || 'No se pudo procesar la imagen' });
      }
    }

    const { data, error } = await supabase
      .from('slot_catalog_items')
      .insert([
        {
          reference,
          manufacturer,
          model_name,
          vehicle_type,
          commercial_release_date,
          image_url,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un ítem con esa referencia' });
      }
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /items/:id
 */
router.put('/items/:id', itemUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing, error: exErr } = await supabase.from('slot_catalog_items').select('*').eq('id', id).maybeSingle();
    if (exErr) return res.status(500).json({ error: exErr.message });
    if (!existing) return res.status(404).json({ error: 'Ítem no encontrado' });

    const reference = req.body.reference != null ? normalizeReference(req.body.reference) : existing.reference;
    const manufacturer = req.body.manufacturer != null ? String(req.body.manufacturer).trim() : existing.manufacturer;
    const model_name = req.body.model_name != null ? String(req.body.model_name).trim() : existing.model_name;
    const vehicle_type =
      req.body.vehicle_type !== undefined
        ? parseOptionalVehicleType(req.body.vehicle_type)
        : existing.vehicle_type;
    const commercial_release_date =
      req.body.commercial_release_date !== undefined
        ? parseOptionalDate(req.body.commercial_release_date)
        : existing.commercial_release_date;

    let image_url = existing.image_url;
    const img = req.files?.image?.[0];
    if (img) {
      try {
        if (existing.image_url) {
          await removeCatalogObjectByPublicUrl(supabase, existing.image_url);
        }
        image_url = await uploadCatalogImageBuffer(supabase, img.buffer, img.mimetype);
      } catch (e) {
        return res.status(400).json({ error: e.message || 'No se pudo procesar la imagen' });
      }
    }

    const { data, error } = await supabase
      .from('slot_catalog_items')
      .update({
        reference,
        manufacturer,
        model_name,
        vehicle_type,
        commercial_release_date,
        image_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un ítem con esa referencia' });
      }
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /items/:id
 */
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing, error: exErr } = await supabase.from('slot_catalog_items').select('image_url').eq('id', id).maybeSingle();
    if (exErr) return res.status(500).json({ error: exErr.message });
    if (!existing) return res.status(404).json({ error: 'Ítem no encontrado' });

    if (existing.image_url) {
      const { error: rmErr } = await removeCatalogObjectByPublicUrl(supabase, existing.image_url);
      if (rmErr) console.warn('[catalog] remove image', rmErr.message);
    }

    const { error } = await supabase.from('slot_catalog_items').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const changeUpload = upload.fields([{ name: 'image', maxCount: 1 }]);

/**
 * POST /items/:catalogItemId/change-requests
 */
router.post('/items/:catalogItemId/change-requests', changeUpload, async (req, res) => {
  try {
    const { catalogItemId } = req.params;
    const { data: item, error: iErr } = await supabase.from('slot_catalog_items').select('*').eq('id', catalogItemId).maybeSingle();
    if (iErr) return res.status(500).json({ error: iErr.message });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

    const proposed_patch = {
      manufacturer: req.body.manufacturer != null ? String(req.body.manufacturer).trim() : item.manufacturer,
      model_name: req.body.model_name != null ? String(req.body.model_name).trim() : item.model_name,
      vehicle_type:
        req.body.vehicle_type !== undefined
          ? parseOptionalVehicleType(req.body.vehicle_type)
          : item.vehicle_type,
      commercial_release_date:
        req.body.commercial_release_date !== undefined
          ? parseOptionalDate(req.body.commercial_release_date)
          : item.commercial_release_date,
      image_url: item.image_url,
    };

    const img = req.files?.image?.[0];
    if (img) {
      try {
        proposed_patch.image_url = await uploadCatalogImageBuffer(supabase, img.buffer, img.mimetype);
      } catch (e) {
        return res.status(400).json({ error: e.message || 'No se pudo procesar la imagen' });
      }
    }

    const { data, error } = await supabase
      .from('slot_catalog_change_requests')
      .insert([
        {
          catalog_item_id: catalogItemId,
          proposed_patch,
          submitted_by: req.user.id,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /change-requests?status=pending
 */
router.get('/change-requests', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending').toLowerCase();
    const ok = ['pending', 'approved', 'rejected', 'all'];
    const st = ok.includes(status) ? status : 'pending';
    let q = supabase
      .from('slot_catalog_change_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (st !== 'all') q = q.eq('status', st);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ requests: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /change-requests/:requestId/approve
 */
router.post('/change-requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { data: row, error: rErr } = await supabase
      .from('slot_catalog_change_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (rErr) return res.status(500).json({ error: rErr.message });
    if (!row || row.status !== 'pending') {
      return res.status(400).json({ error: 'Solicitud no válida o ya procesada' });
    }

    const patch = row.proposed_patch || {};
    const { data: item, error: iErr } = await supabase.from('slot_catalog_items').select('*').eq('id', row.catalog_item_id).maybeSingle();
    if (iErr) return res.status(500).json({ error: iErr.message });
    if (!item) return res.status(404).json({ error: 'Ítem de catálogo no encontrado' });

    if (patch.image_url && item.image_url && patch.image_url !== item.image_url) {
      const { error: rmErr } = await removeCatalogObjectByPublicUrl(supabase, item.image_url);
      if (rmErr) console.warn('[catalog] remove old image', rmErr.message);
    }

    const { error: upErr } = await supabase
      .from('slot_catalog_items')
      .update({
        manufacturer: patch.manufacturer ?? item.manufacturer,
        model_name: patch.model_name ?? item.model_name,
        vehicle_type: patch.vehicle_type !== undefined ? patch.vehicle_type : item.vehicle_type,
        commercial_release_date: patch.commercial_release_date ?? null,
        image_url: patch.image_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.catalog_item_id);

    if (upErr) return res.status(500).json({ error: upErr.message });

    const { error: finErr } = await supabase
      .from('slot_catalog_change_requests')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (finErr) return res.status(500).json({ error: finErr.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /change-requests/:requestId/reject
 */
router.post('/change-requests/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 2000) : null;
    const { data: row, error: rErr } = await supabase
      .from('slot_catalog_change_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (rErr) return res.status(500).json({ error: rErr.message });
    if (!row || row.status !== 'pending') {
      return res.status(400).json({ error: 'Solicitud no válida o ya procesada' });
    }

    const { error } = await supabase
      .from('slot_catalog_change_requests')
      .update({
        status: 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', requestId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const insertUpload = upload.fields([{ name: 'image', maxCount: 1 }]);

/**
 * POST /insert-requests
 */
router.post('/insert-requests', insertUpload, async (req, res) => {
  try {
    const proposed_reference = normalizeReference(req.body.proposed_reference ?? req.body.reference);
    const proposed_manufacturer = String(req.body.proposed_manufacturer ?? req.body.manufacturer ?? '').trim();
    const proposed_model_name = String(req.body.proposed_model_name ?? req.body.model_name ?? '').trim();
    const proposed_vehicle_type = parseOptionalVehicleType(
      req.body.proposed_vehicle_type ?? req.body.vehicle_type,
    );
    const proposed_commercial_release_date = parseOptionalDate(
      req.body.proposed_commercial_release_date ?? req.body.commercial_release_date,
    );

    if (!proposed_reference || !proposed_manufacturer || !proposed_model_name) {
      return res.status(400).json({ error: 'reference, manufacturer y model_name son obligatorios' });
    }

    let proposed_image_url = null;
    const img = req.files?.image?.[0];
    if (img) {
      try {
        proposed_image_url = await uploadCatalogImageBuffer(supabase, img.buffer, img.mimetype);
      } catch (e) {
        return res.status(400).json({ error: e.message || 'No se pudo procesar la imagen' });
      }
    }

    const { data, error } = await supabase
      .from('slot_catalog_insert_requests')
      .insert([
        {
          proposed_reference,
          proposed_manufacturer,
          proposed_model_name,
          proposed_vehicle_type,
          proposed_commercial_release_date,
          proposed_image_url,
          submitted_by: req.user.id,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /insert-requests?status=
 */
router.get('/insert-requests', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending').toLowerCase();
    const ok = ['pending', 'approved', 'rejected', 'all'];
    const st = ok.includes(status) ? status : 'pending';
    let q = supabase.from('slot_catalog_insert_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (st !== 'all') q = q.eq('status', st);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ requests: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /insert-requests/:requestId/approve
 */
router.post('/insert-requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { data: row, error: rErr } = await supabase
      .from('slot_catalog_insert_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (rErr) return res.status(500).json({ error: rErr.message });
    if (!row || row.status !== 'pending') {
      return res.status(400).json({ error: 'Solicitud no válida o ya procesada' });
    }

    const { data: created, error: cErr } = await supabase
      .from('slot_catalog_items')
      .insert([
        {
          reference: normalizeReference(row.proposed_reference),
          manufacturer: row.proposed_manufacturer,
          model_name: row.proposed_model_name,
          vehicle_type: row.proposed_vehicle_type ?? null,
          commercial_release_date: row.proposed_commercial_release_date,
          image_url: row.proposed_image_url,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (cErr) {
      if (cErr.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un ítem con esa referencia en el catálogo' });
      }
      return res.status(500).json({ error: cErr.message });
    }

    const { error: uErr } = await supabase
      .from('slot_catalog_insert_requests')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        created_catalog_item_id: created.id,
      })
      .eq('id', requestId);

    if (uErr) return res.status(500).json({ error: uErr.message });
    res.json({ ok: true, catalog_item: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /insert-requests/:requestId/reject
 */
router.post('/insert-requests/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    const reason = req.body?.reason != null ? String(req.body.reason).slice(0, 2000) : null;
    const { data: row, error: rErr } = await supabase
      .from('slot_catalog_insert_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (rErr) return res.status(500).json({ error: rErr.message });
    if (!row || row.status !== 'pending') {
      return res.status(400).json({ error: 'Solicitud no válida o ya procesada' });
    }

    const { error } = await supabase
      .from('slot_catalog_insert_requests')
      .update({
        status: 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', requestId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /import — multipart: file, duplicateMode=skip|update|fail, sheetIndex (excel)
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Archivo requerido (field: file)' });

    const duplicateMode = String(req.query.duplicateMode || req.body.duplicateMode || 'skip').toLowerCase();
    if (!['skip', 'update', 'fail'].includes(duplicateMode)) {
      return res.status(400).json({ error: 'duplicateMode debe ser skip, update o fail' });
    }

    const sheetIndex = Math.max(0, parseInt(String(req.query.sheetIndex ?? req.body.sheetIndex ?? '0'), 10) || 0);
    const mime = file.mimetype || '';
    const name = file.originalname || '';

    let rows = [];

    if (mime.includes('csv') || name.toLowerCase().endsWith('.csv')) {
      const text = file.buffer.toString('utf8');
      rows = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (
      mime.includes('spreadsheet') ||
      mime.includes('excel') ||
      name.toLowerCase().endsWith('.xlsx') ||
      name.toLowerCase().endsWith('.xls')
    ) {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const sn = wb.SheetNames[sheetIndex];
      if (!sn) return res.status(400).json({ error: 'Hoja no encontrada' });
      const sheet = wb.Sheets[sn];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else if (mime.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({
        error: 'Importación PDF no está soportada; exporta a CSV o Excel e importa de nuevo.',
      });
    } else {
      return res.status(400).json({ error: 'Formato no soportado. Usa CSV o Excel (.xlsx/.xls).' });
    }

    const inserted = [];
    const updated = [];
    const skipped = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      const ref = normalizeReference(r.reference ?? r.Reference ?? r.REFERENCIA ?? r.ref);
      const manufacturer = String(r.manufacturer ?? r.Marca ?? r.fabricante ?? '').trim();
      const model_name = String(r.model_name ?? r.model ?? r.nombre ?? r.Nombre ?? '').trim();
      const vehicle_type = parseOptionalVehicleType(
        r.vehicle_type ?? r.tipo ?? r.type ?? r.Tipo ?? '',
      );
      const commercial_release_date = parseOptionalDate(
        r.commercial_release_date ?? r.fecha ?? r.release_date ?? '',
      );

      if (!ref || !manufacturer || !model_name) {
        errors.push({ row: rowNum, message: 'Faltan reference, manufacturer o model_name' });
        continue;
      }

      const { data: existing } = await supabase.from('slot_catalog_items').select('id').eq('reference', ref).maybeSingle();

      if (existing) {
        if (duplicateMode === 'skip') {
          skipped.push(ref);
          continue;
        }
        if (duplicateMode === 'fail') {
          errors.push({ row: rowNum, message: `Referencia duplicada: ${ref}` });
          continue;
        }
        const { error: upErr } = await supabase
          .from('slot_catalog_items')
          .update({
            manufacturer,
            model_name,
            vehicle_type,
            commercial_release_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (upErr) errors.push({ row: rowNum, message: upErr.message });
        else updated.push(ref);
        continue;
      }

      const { data: ins, error: insErr } = await supabase
        .from('slot_catalog_items')
        .insert([
          {
            reference: ref,
            manufacturer,
            model_name,
            vehicle_type,
            commercial_release_date,
            updated_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();

      if (insErr) {
        errors.push({ row: rowNum, message: insErr.message });
      } else {
        inserted.push(ref);
      }
    }

    res.json({
      inserted: inserted.length,
      updated: updated.length,
      skipped: skipped.length,
      insertedRefs: inserted,
      updatedRefs: updated,
      skippedRefs: skipped,
      errors,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
