const express = require('express');
const { body } = require('express-validator');
const { createUserScopedClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { getOrCreateBaseSpecs, updateVehicleTotalPrice } = require('../lib/vehicleSpecs');
const {
  ALLOWED_CATEGORIES,
  resolvePartId,
  buildPartIdentity,
  inventoryCategoryToComponentType,
} = require('../lib/partsRegistry');

const router = express.Router();

const ALLOWED_UNITS = new Set(['uds', 'pares', 'ml', 'metros', 'juego']);

router.use(authMiddleware);
router.use((req, res, next) => {
  req.supabase = createUserScopedClient(req.headers.authorization);
  next();
});

function normalizeDate(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normalizeOptionalText(val) {
  if (val == null) return null;
  const t = String(val).trim();
  return t === '' ? null : t;
}

/** Si el body trae texto no vacío, se usa; si no, el valor guardado en el ítem. */
function mergeSpecText(bodyVal, itemVal) {
  if (bodyVal !== undefined && bodyVal !== null && String(bodyVal).trim() !== '') {
    return normalizeOptionalText(bodyVal);
  }
  return normalizeOptionalText(itemVal);
}

function mergeSpecNum(bodyVal, itemVal) {
  if (bodyVal !== undefined && bodyVal !== null && String(bodyVal).trim() !== '') {
    const n = Number(bodyVal);
    return Number.isNaN(n) ? null : n;
  }
  if (itemVal !== undefined && itemVal !== null && String(itemVal).trim() !== '') {
    const n = Number(itemVal);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function parseOptionalInt(val) {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? NaN : n;
}

function parseOptionalNumber(val) {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? NaN : n;
}

function normalizeUrl(val) {
  const raw = normalizeOptionalText(val);
  if (raw == null) return null;
  try {
    if (/^https?:\/\//i.test(raw)) return new URL(raw).href;
    return new URL(`https://${raw}`).href;
  } catch {
    return '__invalid__';
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} vehicleId
 * @param {string} userId
 */
async function assertVehicleOwned(supabase, vehicleId, userId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function resolveAndAttachPartId(supabase, userId, attrs) {
  const resolved = await resolvePartId(supabase, userId, attrs);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return { ok: true, partId: resolved.part.id, part: resolved.part };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function attachVehicles(supabase, rows, userId) {
  const ids = [...new Set(rows.map((r) => r.vehicle_id).filter(Boolean))];
  if (ids.length === 0) return rows.map((r) => ({ ...r, vehicle: null }));
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, model, manufacturer')
    .eq('user_id', userId)
    .in('id', ids);
  if (error) throw error;
  const map = Object.fromEntries((vehicles || []).map((v) => [v.id, v]));
  return rows.map((r) => ({
    ...r,
    vehicle: r.vehicle_id ? map[r.vehicle_id] || null : null,
  }));
}

/** Máximo de ítems de inventario por consulta agrupada a componentes montados */
const INVENTORY_MOUNT_QUERY_CHUNK = 80;

/**
 * Coches donde este stock está montado (components.source_inventory_item_id),
 * combinado con el vehículo opcional declarado en la fila (`vehicle_id`).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function attachMountedVehiclesFromComponents(supabase, rows, userId) {
  if (!rows || rows.length === 0) return rows;

  /** @type {Map<string, Map<string, { id: string, manufacturer?: string|null, model?: string|null }>>} */
  const byInventory = new Map();

  const invIds = [...new Set(rows.map((r) => r?.id).filter(Boolean))];

  async function ingestChunk(chunkIds) {
    if (chunkIds.length === 0) return;

    const { data: comps, error } = await supabase
      .from('components')
      .select('source_inventory_item_id, tech_spec_id')
      .not('source_inventory_item_id', 'is', null)
      .in('source_inventory_item_id', chunkIds);

    if (error) throw error;

    const specIds = [...new Set((comps || []).map((c) => c.tech_spec_id).filter(Boolean))];
    if (specIds.length === 0) return;

    const { data: specs, error: specsError } = await supabase
      .from('technical_specs')
      .select('id, vehicle_id')
      .in('id', specIds);

    if (specsError) throw specsError;

    /** @type {Record<string, string>} */
    const specVehicle = {};
    const vehicleIds = new Set();

    for (const s of specs || []) {
      if (s?.id && s.vehicle_id) {
        specVehicle[s.id] = s.vehicle_id;
        vehicleIds.add(s.vehicle_id);
      }
    }

    const vids = [...vehicleIds];
    if (vids.length === 0) return;

    const { data: vehRows, error: vehError } = await supabase
      .from('vehicles')
      .select('id, manufacturer, model')
      .eq('user_id', userId)
      .in('id', vids);

    if (vehError) throw vehError;

    /** @type {Record<string, { id: string, manufacturer?: string|null, model?: string|null }>} */
    const vehMap = Object.fromEntries((vehRows || []).map((v) => [v.id, v]));

    for (const c of comps || []) {
      const iid = c.source_inventory_item_id;
      const specId = c.tech_spec_id;
      const vId = specId ? specVehicle[specId] : undefined;
      if (!iid || !vId) continue;

      const vehicle = vehMap[vId];
      if (!vehicle?.id) continue;

      let bucket = byInventory.get(iid);
      if (!bucket) {
        bucket = new Map();
        byInventory.set(iid, bucket);
      }

      bucket.set(vehicle.id, {
        id: vehicle.id,
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
      });
    }
  }

  for (let i = 0; i < invIds.length; i += INVENTORY_MOUNT_QUERY_CHUNK) {
    await ingestChunk(invIds.slice(i, i + INVENTORY_MOUNT_QUERY_CHUNK));
  }

  return rows.map((row) => {
    const merged = new Map();
    if (row?.vehicle_id && row?.vehicle) {
      merged.set(row.vehicle.id, {
        id: row.vehicle.id,
        manufacturer: row.vehicle.manufacturer,
        model: row.vehicle.model,
      });
    }
    const fromComp = row?.id ? byInventory.get(row.id) : undefined;
    if (fromComp) {
      for (const [vid, v] of fromComp) merged.set(vid, v);
    }

    const mountedList = [...merged.values()].sort((a, b) =>
      `${a.manufacturer || ''} ${a.model || ''}`.localeCompare(
        `${b.manufacturer || ''} ${b.model || ''}`,
        undefined,
        { sensitivity: 'base' },
      ),
    );

    return {
      ...row,
      mounted_vehicles: mountedList,
    };
  });
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function enrichInventoryRows(supabase, rows, userId) {
  const withVehicle = await attachVehicles(supabase, rows, userId);
  return attachMountedVehiclesFromComponents(supabase, withVehicle, userId);
}

const PART_QUERY_CHUNK = 80;

/**
 * Agrupa líneas de stock y montajes por part_id.
 * @returns {Promise<object[]>}
 */
async function assemblePartViews(supabase, parts, userId) {
  if (!parts?.length) return [];
  const partIds = parts.map((p) => p.id).filter(Boolean);

  /** @type {Map<string, object[]>} */
  const linesByPart = new Map();
  /** @type {Map<string, object[]>} */
  const mountsByPart = new Map();

  for (let i = 0; i < partIds.length; i += PART_QUERY_CHUNK) {
    const chunk = partIds.slice(i, i + PART_QUERY_CHUNK);
    const { data: lines, error: linesErr } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .in('part_id', chunk)
      .order('created_at', { ascending: true });
    if (linesErr) throw linesErr;
    for (const line of lines || []) {
      if (!line.part_id) continue;
      const arr = linesByPart.get(line.part_id) || [];
      arr.push(line);
      linesByPart.set(line.part_id, arr);
    }

    const { data: comps, error: compsErr } = await supabase
      .from('components')
      .select('id, part_id, mounted_qty, tech_spec_id, source_inventory_item_id')
      .not('part_id', 'is', null)
      .in('part_id', chunk);
    if (compsErr) throw compsErr;

    const specIds = [...new Set((comps || []).map((c) => c.tech_spec_id).filter(Boolean))];
    if (specIds.length === 0) continue;

    const { data: specs, error: specsErr } = await supabase
      .from('technical_specs')
      .select('id, vehicle_id, is_modification')
      .in('id', specIds);
    if (specsErr) throw specsErr;

    const specMap = Object.fromEntries((specs || []).map((s) => [s.id, s]));
    const vehicleIds = [...new Set((specs || []).map((s) => s.vehicle_id).filter(Boolean))];
    if (vehicleIds.length === 0) continue;

    const { data: vehRows, error: vehErr } = await supabase
      .from('vehicles')
      .select('id, manufacturer, model')
      .eq('user_id', userId)
      .in('id', vehicleIds);
    if (vehErr) throw vehErr;
    const vehMap = Object.fromEntries((vehRows || []).map((v) => [v.id, v]));

    for (const c of comps || []) {
      const spec = c.tech_spec_id ? specMap[c.tech_spec_id] : null;
      const vehicle = spec?.vehicle_id ? vehMap[spec.vehicle_id] : null;
      if (!c.part_id || !vehicle) continue;
      const arr = mountsByPart.get(c.part_id) || [];
      arr.push({
        vehicle: {
          id: vehicle.id,
          manufacturer: vehicle.manufacturer,
          model: vehicle.model,
        },
        component_id: c.id,
        mounted_qty: Math.max(1, parseInt(c.mounted_qty, 10) || 1),
        is_modification: !!spec?.is_modification,
      });
      mountsByPart.set(c.part_id, arr);
    }
  }

  return parts.map((part) => {
    const inventoryLines = linesByPart.get(part.id) || [];
    const mountedIn = (mountsByPart.get(part.id) || []).sort((a, b) =>
      `${a.vehicle.manufacturer || ''} ${a.vehicle.model || ''}`.localeCompare(
        `${b.vehicle.manufacturer || ''} ${b.vehicle.model || ''}`,
        undefined,
        { sensitivity: 'base' },
      ),
    );
    const stockQty = inventoryLines.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
    const mountedQty = mountedIn.reduce((sum, row) => sum + (Number(row.mounted_qty) || 0), 0);
    const lowStock = inventoryLines.some(
      (r) => r.min_stock != null && Number(r.quantity) <= Number(r.min_stock),
    );
    return {
      part,
      stock_qty: stockQty,
      mounted_qty: mountedQty,
      low_stock: lowStock,
      inventory_lines: inventoryLines,
      mounted_in: mountedIn,
    };
  });
}

async function loadUserParts(supabase, userId, { category, q } = {}) {
  let query = supabase
    .from('parts')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (category && String(category).trim() !== '' && String(category) !== 'all') {
    if (!ALLOWED_CATEGORIES.has(String(category))) {
      const err = new Error('category no válida');
      err.status = 400;
      throw err;
    }
    query = query.eq('category', String(category));
  }

  const searchQ = q != null && String(q).trim() !== '' ? String(q).trim() : null;
  if (searchQ) {
    const safe = searchQ.replace(/%/g, '').replace(/,/g, ' ').replace(/[()]/g, ' ').trim();
    if (safe) {
      const esc = safe.replace(/_/g, '\\_');
      query = query.or(
        `name.ilike.%${esc}%,reference.ilike.%${esc}%,manufacturer.ilike.%${esc}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * GET /api/inventory?category=&low_stock=true&vehicle_id=&q=
 */
router.get('/', async (req, res) => {
  try {
    const { category, low_stock: lowStock, vehicle_id: vehicleId, q } = req.query;

    let query = req.supabase
      .from('inventory_items')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (category && String(category).trim() !== '' && String(category) !== 'all') {
      if (!ALLOWED_CATEGORIES.has(String(category))) {
        return res.status(400).json({ error: 'category no válida' });
      }
      query = query.eq('category', String(category));
    }

    if (vehicleId && String(vehicleId).trim() !== '') {
      query = query.eq('vehicle_id', String(vehicleId));
    }

    const searchQ = q != null && String(q).trim() !== '' ? String(q).trim() : null;
    if (searchQ) {
      // Evitar romper el operador .or de PostgREST (separador por comas)
      const safe = searchQ.replace(/%/g, '').replace(/,/g, ' ').replace(/[()]/g, ' ').trim();
      if (safe) {
        const esc = safe.replace(/_/g, '\\_');
        query = query.or(`name.ilike.%${esc}%,reference.ilike.%${esc}%`);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error al listar inventario:', error);
      return res.status(500).json({ error: error.message });
    }

    let rows = data || [];

    if (lowStock === 'true' || lowStock === '1') {
      rows = rows.filter(
        (r) => r.min_stock != null && Number(r.quantity) <= Number(r.min_stock),
      );
    }

    const enriched = await enrichInventoryRows(req.supabase, rows, req.user.id);
    res.json(enriched);
  } catch (err) {
    console.error('GET /inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/parts/match
 * Resuelve una pieza candidata por identidad (ficha de vehículo).
 */
router.get('/parts/match', async (req, res) => {
  try {
    const { category, name, manufacturer, reference, sku, teeth, rpm, component_type: componentType } = req.query;
    const { identityKey } = buildPartIdentity({
      category: category || componentType,
      name,
      manufacturer,
      reference: reference || sku,
      teeth,
      rpm,
    });
    if (!name || !String(name).trim()) {
      return res.json(null);
    }

    const { data: part, error } = await req.supabase
      .from('parts')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('identity_key', identityKey)
      .maybeSingle();
    if (error) {
      console.error('GET /inventory/parts/match:', error);
      return res.status(500).json({ error: error.message });
    }
    if (!part) return res.json(null);

    const [view] = await assemblePartViews(req.supabase, [part], req.user.id);
    res.json(view || null);
  } catch (err) {
    console.error('GET /inventory/parts/match:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/parts
 * Vista consolidada: stock + unidades montadas por identidad de pieza.
 */
router.get('/parts', async (req, res) => {
  try {
    const { category, low_stock: lowStock, q, only_mounted: onlyMounted } = req.query;
    const parts = await loadUserParts(req.supabase, req.user.id, { category, q });
    let views = await assemblePartViews(req.supabase, parts, req.user.id);

    if (lowStock === 'true' || lowStock === '1') {
      views = views.filter((v) => v.low_stock);
    }
    if (onlyMounted === 'true' || onlyMounted === '1') {
      views = views.filter((v) => Number(v.mounted_qty) > 0);
    }

    res.json(views);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('GET /inventory/parts:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inventory/parts/:partId
 * Actualiza la identidad/descriptivos de una pieza y propaga a stock y componentes montados.
 * No toca cantidades ni precios.
 */
router.put('/parts/:partId', async (req, res) => {
  try {
    const { partId } = req.params;
    const { data: existing, error: fetchErr } = await req.supabase
      .from('parts')
      .select('*')
      .eq('id', partId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!existing) return res.status(404).json({ error: 'Pieza no encontrada' });

    const next = { ...existing };
    const assignText = (key, val) => {
      if (val === undefined) return;
      next[key] = normalizeOptionalText(val);
    };
    if (req.body.name !== undefined) {
      if (!req.body.name || !String(req.body.name).trim()) {
        return res.status(400).json({ error: 'name no puede estar vacío' });
      }
      next.name = String(req.body.name).trim();
    }
    if (req.body.category !== undefined) {
      if (!ALLOWED_CATEGORIES.has(String(req.body.category))) {
        return res.status(400).json({ error: 'category no válida' });
      }
      next.category = String(req.body.category);
    }
    assignText('manufacturer', req.body.manufacturer);
    assignText('reference', req.body.reference);
    assignText('material', req.body.material);
    assignText('size', req.body.size);
    assignText('color', req.body.color);
    assignText('url', req.body.url);
    assignText('description', req.body.description);

    if (req.body.teeth !== undefined) {
      if (req.body.teeth === null || String(req.body.teeth).trim() === '') next.teeth = null;
      else {
        const t = parseInt(req.body.teeth, 10);
        if (Number.isNaN(t)) return res.status(400).json({ error: 'teeth no válido' });
        next.teeth = t;
      }
    }
    if (req.body.rpm !== undefined) {
      if (req.body.rpm === null || String(req.body.rpm).trim() === '') next.rpm = null;
      else {
        const r = Number(req.body.rpm);
        if (Number.isNaN(r)) return res.status(400).json({ error: 'rpm no válido' });
        next.rpm = r;
      }
    }
    if (req.body.gaus !== undefined) {
      if (req.body.gaus === null || String(req.body.gaus).trim() === '') next.gaus = null;
      else {
        const g = Number(req.body.gaus);
        if (Number.isNaN(g)) return res.status(400).json({ error: 'gaus no válido' });
        next.gaus = g;
      }
    }
    if (req.body.url !== undefined) {
      const urlNorm = normalizeUrl(req.body.url);
      if (urlNorm === '__invalid__') return res.status(400).json({ error: 'url no válida' });
      next.url = urlNorm;
    }

    const patch = {
      name: next.name,
      category: next.category,
      manufacturer: next.manufacturer,
      reference: next.reference,
      teeth: next.teeth,
      rpm: next.rpm,
      material: next.material,
      size: next.size,
      color: next.color,
      gaus: next.gaus,
      url: next.url,
      description: next.description,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedPart, error: updErr } = await req.supabase
      .from('parts')
      .update(patch)
      .eq('id', partId)
      .eq('user_id', req.user.id)
      .select('*')
      .single();

    if (updErr) {
      if (updErr.code === '23505') {
        return res.status(409).json({
          error: 'Ya existe otra pieza con la misma identidad (categoría, nombre, marca, referencia, dientes/rpm).',
        });
      }
      return res.status(500).json({ error: updErr.message });
    }

    const invPatch = {
      name: updatedPart.name,
      category: updatedPart.category,
      manufacturer: updatedPart.manufacturer,
      reference: updatedPart.reference,
      teeth: updatedPart.teeth,
      rpm: updatedPart.rpm,
      material: updatedPart.material,
      size: updatedPart.size,
      color: updatedPart.color,
      gaus: updatedPart.gaus,
      url: updatedPart.url,
      description: updatedPart.description,
      updated_at: new Date().toISOString(),
    };
    const { error: invErr } = await req.supabase
      .from('inventory_items')
      .update(invPatch)
      .eq('part_id', partId)
      .eq('user_id', req.user.id);
    if (invErr) {
      console.error('PUT /inventory/parts propagate inventory:', invErr);
      return res.status(500).json({ error: invErr.message });
    }

    const { error: compErr } = await req.supabase
      .from('components')
      .update({
        element: updatedPart.name,
        sku: updatedPart.reference,
        manufacturer: updatedPart.manufacturer,
        teeth: updatedPart.teeth,
        rpm: updatedPart.rpm,
        material: updatedPart.material,
        size: updatedPart.size,
        color: updatedPart.color,
        gaus: updatedPart.gaus,
        url: updatedPart.url,
        description: updatedPart.description,
        component_type: inventoryCategoryToComponentType(updatedPart.category),
        updated_at: new Date().toISOString(),
      })
      .eq('part_id', partId);
    if (compErr) {
      console.error('PUT /inventory/parts propagate components:', compErr);
      return res.status(500).json({ error: compErr.message });
    }

    const [view] = await assemblePartViews(req.supabase, [updatedPart], req.user.id);
    res.json(view);
  } catch (err) {
    console.error('PUT /inventory/parts/:partId:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/:id/purchase-history
 * Historial de reposiciones (más reciente primero).
 */
router.get('/:id/purchase-history', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item, error: fetchErr } = await req.supabase
      .from('inventory_items')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('GET purchase-history fetch item:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const { data, error } = await req.supabase
      .from('inventory_purchase_history')
      .select('*')
      .eq('inventory_item_id', id)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('GET purchase-history:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (err) {
    console.error('GET /inventory/:id/purchase-history:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/inventory/:id
 * Detalle de un ítem (p. ej. búsqueda global). Tras rutas más específicas como /:id/purchase-history.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'purchase-history' || id === 'parts') {
      return res.status(400).json({ error: 'id no válido' });
    }

    const { data, error } = await req.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) {
      console.error('GET /inventory/:id:', error);
      return res.status(500).json({ error: error.message });
    }
    if (!data) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const [enriched] = await enrichInventoryRows(req.supabase, [data], req.user.id);
    res.json(enriched);
  } catch (err) {
    console.error('GET /inventory/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/:id/restock
 * Añade unidades al stock y registra la compra en el historial.
 */
router.post('/:id/restock', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      quantity: qtyRaw,
      purchase_price: purchasePrice,
      supplier: supplierRaw,
      purchase_date: purchaseDate,
      notes: notesRaw,
    } = req.body;

    const addQty =
      qtyRaw === undefined || qtyRaw === null || String(qtyRaw).trim() === ''
        ? NaN
        : parseInt(qtyRaw, 10);
    if (Number.isNaN(addQty) || addQty < 1) {
      return res.status(400).json({ error: 'quantity debe ser un entero mayor o igual a 1' });
    }

    let price = null;
    if (purchasePrice !== undefined && purchasePrice !== null && String(purchasePrice).trim() !== '') {
      price = Number(purchasePrice);
      if (Number.isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'purchase_price no válido' });
      }
    }

    const supplier = normalizeOptionalText(supplierRaw);
    const pDate = normalizeDate(purchaseDate);
    const notes = normalizeOptionalText(notesRaw);

    const { data: existing, error: fetchErr } = await req.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('restock fetch item:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }
    if (!existing) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const historyRow = {
      inventory_item_id: id,
      user_id: req.user.id,
      quantity: addQty,
      purchase_price: price,
      supplier,
      purchase_date: pDate,
      notes,
    };

    const { data: insertedHist, error: histErr } = await req.supabase
      .from('inventory_purchase_history')
      .insert([historyRow])
      .select('id')
      .single();

    if (histErr || !insertedHist) {
      console.error('restock insert history:', histErr);
      return res.status(500).json({ error: histErr?.message || 'Error al registrar la compra' });
    }

    const prevQty = Number(existing.quantity);
    const newQty = prevQty + addQty;

    const invUpdates = {
      quantity: newQty,
      updated_at: new Date().toISOString(),
    };
    if (price != null) {
      invUpdates.purchase_price = price;
    }
    if (pDate != null) {
      invUpdates.purchase_date = pDate;
    }

    const { data: updatedInv, error: updErr } = await req.supabase
      .from('inventory_items')
      .update(invUpdates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .eq('quantity', prevQty)
      .select('*')
      .maybeSingle();

    if (updErr || !updatedInv) {
      await req.supabase.from('inventory_purchase_history').delete().eq('id', insertedHist.id);
      return res.status(409).json({
        error:
          'No se pudo actualizar el stock (posible condición de carrera). Recarga e inténtalo de nuevo.',
      });
    }

    const [enriched] = await enrichInventoryRows(req.supabase, [updatedInv], req.user.id);
    res.status(201).json({
      inventory_item: enriched,
      purchase_entry: { ...historyRow, id: insertedHist.id },
    });
  } catch (err) {
    console.error('POST /inventory/:id/restock:', err);
    res.status(500).json({ error: err.message });
  }
});

const inventoryCreateValidators = [
  body('name').trim().notEmpty().isLength({ max: 500 }),
  body('category').notEmpty().isIn([...ALLOWED_CATEGORIES]),
  body('quantity').optional({ nullable: true }).isInt({ min: 0 }),
  body('unit').optional({ nullable: true }).isIn([...ALLOWED_UNITS]),
  body('reference').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('url').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 5000 }),
];

/**
 * POST /api/inventory
 */
router.post('/', inventoryCreateValidators, handleValidationErrors, async (req, res) => {
  try {
    const {
      name,
      reference,
      url,
      category,
      quantity,
      unit,
      min_stock: minStock,
      purchase_price: purchasePrice,
      purchase_date: purchaseDate,
      notes,
      vehicle_id: vehicleId,
      manufacturer,
      material,
      size,
      color,
      teeth: teethRaw,
      rpm: rpmRaw,
      gaus: gausRaw,
      description: specDescription,
    } = req.body;

    const qty =
      quantity === undefined || quantity === null || String(quantity).trim() === ''
        ? 0
        : parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'quantity debe ser un entero mayor o igual a 0' });
    }

    const u = unit != null && String(unit).trim() !== '' ? String(unit) : 'uds';
    if (!ALLOWED_UNITS.has(u)) {
      return res.status(400).json({ error: 'unit no válida' });
    }

    const urlNorm = normalizeUrl(url);
    if (urlNorm === '__invalid__') {
      return res.status(400).json({ error: 'url no válida' });
    }

    let minS = null;
    if (minStock !== undefined && minStock !== null && String(minStock).trim() !== '') {
      minS = parseInt(minStock, 10);
      if (Number.isNaN(minS) || minS < 0) {
        return res.status(400).json({ error: 'min_stock debe ser un entero mayor o igual a 0' });
      }
    }

    let price = null;
    if (purchasePrice !== undefined && purchasePrice !== null && String(purchasePrice).trim() !== '') {
      price = Number(purchasePrice);
      if (Number.isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'purchase_price no válido' });
      }
    }

    const pDate = normalizeDate(purchaseDate);

    const teethPost = parseOptionalInt(teethRaw);
    if (teethRaw !== undefined && teethRaw !== null && String(teethRaw).trim() !== '' && Number.isNaN(teethPost)) {
      return res.status(400).json({ error: 'teeth no válido' });
    }
    const rpmPost = parseOptionalNumber(rpmRaw);
    if (rpmRaw !== undefined && rpmRaw !== null && String(rpmRaw).trim() !== '' && Number.isNaN(rpmPost)) {
      return res.status(400).json({ error: 'rpm no válido' });
    }
    const gausPost = parseOptionalNumber(gausRaw);
    if (gausRaw !== undefined && gausRaw !== null && String(gausRaw).trim() !== '' && Number.isNaN(gausPost)) {
      return res.status(400).json({ error: 'gaus no válido' });
    }

    let vId = null;
    if (vehicleId != null && String(vehicleId).trim() !== '' && String(vehicleId) !== 'none') {
      const owned = await assertVehicleOwned(req.supabase, String(vehicleId), req.user.id);
      if (!owned) return res.status(404).json({ error: 'Vehículo no encontrado' });
      vId = String(vehicleId);
    }

    const partRes = await resolveAndAttachPartId(req.supabase, req.user.id, {
      category: String(category),
      name: String(name).trim(),
      manufacturer,
      reference,
      teeth: teethPost,
      rpm: rpmPost,
      material,
      size,
      color,
      gaus: gausPost,
      url: urlNorm,
      description: specDescription,
    });
    if (!partRes.ok) {
      return res.status(500).json({ error: partRes.error });
    }

    const row = {
      user_id: req.user.id,
      name: String(name).trim(),
      reference: normalizeOptionalText(reference),
      url: urlNorm,
      category: String(category),
      quantity: qty,
      unit: u,
      min_stock: minS,
      purchase_price: price,
      purchase_date: pDate,
      notes: normalizeOptionalText(notes),
      vehicle_id: vId,
      manufacturer: normalizeOptionalText(manufacturer),
      material: normalizeOptionalText(material),
      size: normalizeOptionalText(size),
      color: normalizeOptionalText(color),
      teeth: teethPost,
      rpm: rpmPost,
      gaus: gausPost,
      description: normalizeOptionalText(specDescription),
      part_id: partRes.partId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await req.supabase.from('inventory_items').insert([row]).select('*').single();

    if (error) {
      console.error('Error al crear inventario:', error);
      return res.status(500).json({ error: error.message });
    }

    const [enriched] = await enrichInventoryRows(req.supabase, [data], req.user.id);
    res.status(201).json(enriched);
  } catch (err) {
    console.error('POST /inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/inventory/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await req.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('Error al buscar item:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }
    if (!existing) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const updates = { updated_at: new Date().toISOString() };

    if (req.body.name !== undefined) {
      if (!req.body.name || !String(req.body.name).trim()) {
        return res.status(400).json({ error: 'name no puede estar vacío' });
      }
      updates.name = String(req.body.name).trim();
    }
    if (req.body.reference !== undefined) {
      updates.reference = normalizeOptionalText(req.body.reference);
    }
    if (req.body.url !== undefined) {
      const urlNorm = normalizeUrl(req.body.url);
      if (urlNorm === '__invalid__') {
        return res.status(400).json({ error: 'url no válida' });
      }
      updates.url = urlNorm;
    }
    if (req.body.category !== undefined) {
      if (!ALLOWED_CATEGORIES.has(String(req.body.category))) {
        return res.status(400).json({ error: 'category no válida' });
      }
      updates.category = String(req.body.category);
    }
    if (req.body.quantity !== undefined) {
      const qty = parseInt(req.body.quantity, 10);
      if (Number.isNaN(qty) || qty < 0) {
        return res.status(400).json({ error: 'quantity debe ser un entero mayor o igual a 0' });
      }
      updates.quantity = qty;
    }
    if (req.body.unit !== undefined) {
      const u = String(req.body.unit);
      if (!ALLOWED_UNITS.has(u)) {
        return res.status(400).json({ error: 'unit no válida' });
      }
      updates.unit = u;
    }
    if (req.body.min_stock !== undefined) {
      if (req.body.min_stock === null || String(req.body.min_stock).trim() === '') {
        updates.min_stock = null;
      } else {
        const minS = parseInt(req.body.min_stock, 10);
        if (Number.isNaN(minS) || minS < 0) {
          return res.status(400).json({ error: 'min_stock no válido' });
        }
        updates.min_stock = minS;
      }
    }
    if (req.body.purchase_price !== undefined) {
      if (req.body.purchase_price === null || String(req.body.purchase_price).trim() === '') {
        updates.purchase_price = null;
      } else {
        const price = Number(req.body.purchase_price);
        if (Number.isNaN(price) || price < 0) {
          return res.status(400).json({ error: 'purchase_price no válido' });
        }
        updates.purchase_price = price;
      }
    }
    if (req.body.purchase_date !== undefined) {
      updates.purchase_date = normalizeDate(req.body.purchase_date);
    }
    if (req.body.notes !== undefined) {
      updates.notes = normalizeOptionalText(req.body.notes);
    }
    if (req.body.manufacturer !== undefined) {
      updates.manufacturer = normalizeOptionalText(req.body.manufacturer);
    }
    if (req.body.material !== undefined) {
      updates.material = normalizeOptionalText(req.body.material);
    }
    if (req.body.size !== undefined) {
      updates.size = normalizeOptionalText(req.body.size);
    }
    if (req.body.color !== undefined) {
      updates.color = normalizeOptionalText(req.body.color);
    }
    if (req.body.teeth !== undefined) {
      if (req.body.teeth === null || String(req.body.teeth).trim() === '') {
        updates.teeth = null;
      } else {
        const t = parseInt(req.body.teeth, 10);
        if (Number.isNaN(t)) {
          return res.status(400).json({ error: 'teeth no válido' });
        }
        updates.teeth = t;
      }
    }
    if (req.body.rpm !== undefined) {
      if (req.body.rpm === null || String(req.body.rpm).trim() === '') {
        updates.rpm = null;
      } else {
        const r = Number(req.body.rpm);
        if (Number.isNaN(r)) {
          return res.status(400).json({ error: 'rpm no válido' });
        }
        updates.rpm = r;
      }
    }
    if (req.body.gaus !== undefined) {
      if (req.body.gaus === null || String(req.body.gaus).trim() === '') {
        updates.gaus = null;
      } else {
        const g = Number(req.body.gaus);
        if (Number.isNaN(g)) {
          return res.status(400).json({ error: 'gaus no válido' });
        }
        updates.gaus = g;
      }
    }
    if (req.body.description !== undefined) {
      updates.description = normalizeOptionalText(req.body.description);
    }
    if (req.body.vehicle_id !== undefined) {
      const vid = req.body.vehicle_id;
      if (vid == null || String(vid).trim() === '' || String(vid) === 'none') {
        updates.vehicle_id = null;
      } else {
        const owned = await assertVehicleOwned(req.supabase, String(vid), req.user.id);
        if (!owned) return res.status(404).json({ error: 'Vehículo no encontrado' });
        updates.vehicle_id = String(vid);
      }
    }

    const mergedForPart = { ...existing, ...updates };
    const partRes = await resolveAndAttachPartId(req.supabase, req.user.id, mergedForPart);
    if (!partRes.ok) {
      return res.status(500).json({ error: partRes.error });
    }
    updates.part_id = partRes.partId;

    const { data, error } = await req.supabase
      .from('inventory_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error al actualizar inventario:', error);
      return res.status(500).json({ error: error.message });
    }

    const [enriched] = await enrichInventoryRows(req.supabase, [data], req.user.id);
    res.json(enriched);
  } catch (err) {
    console.error('PUT /inventory/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/inventory/:id/mount
 * Crea un componente en el vehículo y descuenta mount_qty unidades de stock (atómico con bloqueo optimista).
 */
router.post('/:id/mount', async (req, res) => {
  try {
    const { id: inventoryId } = req.params;
    const {
      vehicle_id: bodyVehicleId,
      is_modification: isModificationBody,
      mount_qty: mountQtyRaw,
      manufacturer,
      material,
      size,
      color,
      teeth,
      rpm,
      gaus,
      description,
    } = req.body;

    const isModification = isModificationBody !== false;

    const mountQty = mountQtyRaw != null ? parseInt(mountQtyRaw, 10) : 1;
    if (Number.isNaN(mountQty) || mountQty < 1) {
      return res.status(400).json({ error: 'mount_qty debe ser un entero mayor o igual a 1' });
    }

    const { data: item, error: fetchErr } = await req.supabase
      .from('inventory_items')
      .select('*')
      .eq('id', inventoryId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchErr) {
      console.error('mount fetch item:', fetchErr);
      return res.status(500).json({ error: fetchErr.message });
    }
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    const shouldDeduct = isModification;
    if (shouldDeduct && Number(item.quantity) < mountQty) {
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    let vehicleId = null;
    if (
      bodyVehicleId != null &&
      String(bodyVehicleId).trim() !== '' &&
      String(bodyVehicleId) !== 'none'
    ) {
      vehicleId = String(bodyVehicleId);
    } else if (item.vehicle_id) {
      vehicleId = String(item.vehicle_id);
    }
    if (!vehicleId) {
      return res.status(400).json({ error: 'vehicle_id es requerido' });
    }

    const owned = await assertVehicleOwned(req.supabase, vehicleId, req.user.id);
    if (!owned) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const compType = inventoryCategoryToComponentType(item.category);

    const manufacturerResolved = mergeSpecText(manufacturer, item.manufacturer);
    if (!manufacturerResolved) {
      return res.status(400).json({ error: 'manufacturer es requerido' });
    }

    const teethMerged = mergeSpecNum(teeth, item.teeth);
    const rpmMerged = mergeSpecNum(rpm, item.rpm);
    const gausMerged = mergeSpecNum(gaus, item.gaus);

    if (['pinion', 'crown'].includes(compType)) {
      if (teethMerged == null || Number.isNaN(teethMerged)) {
        return res.status(400).json({ error: 'teeth es requerido para piñón/corona' });
      }
    }
    if (compType === 'motor') {
      if (rpmMerged == null || Number.isNaN(rpmMerged)) {
        return res.status(400).json({ error: 'rpm es requerido para motor' });
      }
    }

    const specs = await getOrCreateBaseSpecs(vehicleId);
    const targetSpec = isModification ? specs.modification : specs.technical;

    let partId = item.part_id || null;
    if (!partId) {
      const partRes = await resolveAndAttachPartId(req.supabase, req.user.id, {
        ...item,
        manufacturer: manufacturerResolved,
        teeth: teethMerged,
        rpm: rpmMerged,
        gaus: gausMerged,
      });
      if (!partRes.ok) return res.status(500).json({ error: partRes.error });
      partId = partRes.partId;
      await req.supabase
        .from('inventory_items')
        .update({ part_id: partId, updated_at: new Date().toISOString() })
        .eq('id', inventoryId)
        .eq('user_id', req.user.id);
    }

    const row = {
      tech_spec_id: targetSpec.id,
      component_type: compType,
      element: String(item.name).trim(),
      manufacturer: manufacturerResolved,
      material: mergeSpecText(material, item.material),
      size: mergeSpecText(size, item.size),
      color: mergeSpecText(color, item.color),
      teeth: ['pinion', 'crown'].includes(compType) ? teethMerged : null,
      rpm: compType === 'motor' ? rpmMerged : null,
      gaus: compType === 'motor' ? gausMerged : null,
      price:
        item.purchase_price != null && item.purchase_price !== ''
          ? Number(item.purchase_price)
          : null,
      url: item.url || null,
      sku: item.reference || null,
      description: mergeSpecText(description, item.description),
      mounted_qty: mountQty,
      source_inventory_item_id: inventoryId,
      part_id: partId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await req.supabase
      .from('components')
      .insert([row])
      .select('*')
      .single();

    if (insErr) {
      console.error('mount insert component:', insErr);
      return res.status(500).json({ error: insErr.message });
    }

    let updatedInv = item;
    if (shouldDeduct) {
      const prevQty = Number(item.quantity);
      const { data: deducted, error: updErr } = await req.supabase
        .from('inventory_items')
        .update({
          quantity: prevQty - mountQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inventoryId)
        .eq('user_id', req.user.id)
        .eq('quantity', prevQty)
        .select('*')
        .maybeSingle();

      if (updErr || !deducted) {
        await req.supabase.from('components').delete().eq('id', inserted.id);
        return res.status(409).json({
          error:
            'No se pudo actualizar el stock (posible condición de carrera o stock agotado). Reintenta.',
        });
      }
      updatedInv = deducted;
    }

    if (isModification) {
      await updateVehicleTotalPrice(vehicleId);
    }

    const [enriched] = await enrichInventoryRows(req.supabase, [updatedInv], req.user.id);
    res.status(201).json({
      component: inserted,
      inventory_item: enriched,
      technical_spec: targetSpec,
    });
  } catch (err) {
    console.error('POST /inventory/:id/mount:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/inventory/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await req.supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id');

    if (error) {
      console.error('Error al eliminar inventario:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('DELETE /inventory/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
