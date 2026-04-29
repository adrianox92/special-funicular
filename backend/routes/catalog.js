/**
 * Catálogo slot — Admin: CRUD, importación, colas y aprobaciones.
 * Usuarios autenticados: sugerencias, valoraciones, GET /search y /my-requests.
 */
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { getAnonClient, getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { assertLicenseAdmin } = require('../lib/licenseAdminAuth');
const {
  uploadCatalogImageBuffer,
  uploadBrandLogoBuffer,
  removeCatalogObjectByPublicUrl,
} = require('../lib/catalogImageStorage');
const { catalogContributionsLimiter } = require('../middleware/rateLimits');
const { isExcelImportFile, normalizeBlankColumnHeaders } = require('../lib/vehicleImport');
const { parseImportCommercialReleaseYear } = require('../lib/importDateParse');

const supabase = getAnonClient();

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function escapeIlikePattern(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

function normalizeReference(ref) {
  return String(ref ?? '')
    .trim()
    .toUpperCase();
}

function normalizeManufacturer(m) {
  return String(m ?? '').trim();
}

function parseOptionalYear(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
  return n;
}

/** Año desde texto, número o fecha ISO / serial Excel (import CSV/Excel). */
function parseYearFromImportCell(raw) {
  return parseImportCommercialReleaseYear(raw);
}

function parseYearFromBody(raw) {
  if (raw == null || raw === '') return null;
  const y = parseOptionalYear(raw);
  if (y != null) return y;
  return parseYearFromImportCell(raw);
}

function resolveCatalogYearFromPatch(patch, item) {
  if (patch.commercial_release_year !== undefined) {
    if (patch.commercial_release_year === null || patch.commercial_release_year === '') return null;
    const y = parseYearFromBody(patch.commercial_release_year);
    if (y != null) return y;
  }
  if (patch.commercial_release_date != null && patch.commercial_release_date !== '') {
    const y = parseYearFromImportCell(patch.commercial_release_date);
    if (y != null) return y;
  }
  return item.commercial_release_year ?? null;
}

/** Tipo de vehículo (misma semántica que vehicles.type). */
function parseOptionalVehicleType(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

/** Tracción (texto libre, como en vehicles.traction). */
function parseOptionalTraction(raw) {
  return parseOptionalVehicleType(raw);
}

/** Posición del motor: inline | angular | transverse. */
function parseOptionalMotorPosition(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'inline' || s === 'angular' || s === 'transverse') return s;
  if (s === 'en_linea' || s === 'en línea' || s === 'en linea' || s === 'lineal') return 'inline';
  if (s === 'en_angular' || s === 'en angular') return 'angular';
  if (s === 'transversal' || s === 'transversa' || s === 'en_transversal' || s === 'en transversal') return 'transverse';
  return null;
}

function parseMotorPositionFromImportCell(raw) {
  return parseOptionalMotorPosition(raw);
}

/** Boolean desde multipart (true/false/on) o JSON. Por defecto false si no viene. */
function parseBodyBool(raw) {
  if (raw === undefined || raw === null || raw === '') return false;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'yes' || s === 'sí' || s === 'si';
}

function parseOptionalBoolFromImportCell(raw) {
  if (raw === undefined || raw === null || raw === '') return false;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'sí', 'si', 'x', 's'].includes(s)) return true;
  if (['0', 'false', 'no', 'n'].includes(s)) return false;
  return false;
}

function normCatalogDorsal(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

function parseCatalogLimitedEditionTotal(raw) {
  if (raw == null || raw === '') return null;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Primer valor no vacío de la fila de importación por lista de nombres de columna posibles. */
function catalogImportPick(row, aliases) {
  for (const name of aliases) {
    if (!Object.prototype.hasOwnProperty.call(row, name)) continue;
    const v = row[name];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  const lowerMap = new Map();
  for (const k of Object.keys(row)) {
    lowerMap.set(String(k).trim().toLowerCase(), row[k]);
  }
  for (const name of aliases) {
    const v = lowerMap.get(String(name).trim().toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function adminGuard(req, res, next) {
  if (!assertLicenseAdmin(req, res)) return;
  next();
}

/**
 * Completitud ponderada del catálogo (dashboard admin). Marca excluida: `manufacturer_id` es NOT NULL
 * y no discrimina. Pesos sobre 6 campos, suma 1 — imagen 30%; nombre, tipo, tracción, motor y año 14% cada uno.
 */
const CATALOG_COMPLETENESS_WEIGHTS = {
  image_url: 0.3,
  model_name: 0.14,
  vehicle_type: 0.14,
  traction: 0.14,
  motor_position: 0.14,
  commercial_release_year: 0.14,
};

/** Año de comercialización válido para métricas “sin año” y ponderación. */
function catalogYearPresent(y) {
  if (y == null || y === '') return false;
  const n = Number(y);
  return Number.isFinite(n) && n >= 1900 && n <= 2100;
}

function catalogDorsalPresent(d) {
  if (d == null || d === '') return false;
  return String(d).trim() !== '';
}

function catalogCompletenessFilled(row) {
  return {
    model_name: row.model_name != null && String(row.model_name).trim() !== '',
    vehicle_type: row.vehicle_type != null && String(row.vehicle_type).trim() !== '',
    traction: row.traction != null && String(row.traction).trim() !== '',
    motor_position: row.motor_position != null && String(row.motor_position).trim() !== '',
    image_url: row.image_url != null && String(row.image_url).trim() !== '',
    commercial_release_year: catalogYearPresent(row.commercial_release_year),
  };
}

function computeCatalogDashboardStats(rows) {
  const w = CATALOG_COMPLETENESS_WEIGHTS;
  const total = rows.length;
  let sumScores = 0;
  let fullyComplete = 0;
  let withoutImage = 0;
  let withoutVehicleType = 0;
  let withoutTraction = 0;
  let withoutMotor = 0;
  let withoutYear = 0;
  let withoutDorsal = 0;

  for (const row of rows) {
    const f = catalogCompletenessFilled(row);
    sumScores +=
      w.image_url * (f.image_url ? 1 : 0) +
      w.model_name * (f.model_name ? 1 : 0) +
      w.vehicle_type * (f.vehicle_type ? 1 : 0) +
      w.traction * (f.traction ? 1 : 0) +
      w.motor_position * (f.motor_position ? 1 : 0) +
      w.commercial_release_year * (f.commercial_release_year ? 1 : 0);
    if (
      f.model_name &&
      f.vehicle_type &&
      f.traction &&
      f.motor_position &&
      f.image_url &&
      f.commercial_release_year
    ) {
      fullyComplete += 1;
    }
    if (!f.image_url) withoutImage += 1;
    if (!f.vehicle_type) withoutVehicleType += 1;
    if (!f.traction) withoutTraction += 1;
    if (!f.motor_position) withoutMotor += 1;
    if (!catalogYearPresent(row.commercial_release_year)) withoutYear += 1;
    if (!catalogDorsalPresent(row.dorsal)) withoutDorsal += 1;
  }

  const pctRatio = (num, den) => (den > 0 ? Math.round((num / den) * 10000) / 100 : 0);

  return {
    totalItems: total,
    weightedCompletenessPercent: total > 0 ? pctRatio(sumScores, total) : 0,
    fullyCompleteCount: fullyComplete,
    fullyCompletePercent: pctRatio(fullyComplete, total),
    missing: {
      withoutImage,
      withoutVehicleType,
      withoutTraction,
      withoutMotor,
      withoutYear,
      withoutDorsal,
    },
    weights: {
      ...CATALOG_COMPLETENESS_WEIGHTS,
      note: 'Marca (manufacturer_id) no entra en la ponderación.',
    },
  };
}

async function fetchAllSlotCatalogRowsForStats() {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from('slot_catalog_items')
      .select('model_name, vehicle_type, traction, motor_position, image_url, commercial_release_year, dorsal')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function parseRatingBody(raw) {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

/** Resuelve UUID de marca por nombre (trim, case-insensitive) vía RPC en BD. */
async function findBrandIdByName(raw) {
  const s = normalizeManufacturer(raw);
  if (!s) return null;
  const { data, error } = await supabase.rpc('slot_catalog_brand_id_by_name', { p_name: s });
  if (error) return null;
  return data || null;
}

async function resolveManufacturerIdFromBody(reqBody, existingManufacturerId) {
  if (reqBody.manufacturer_id != null && String(reqBody.manufacturer_id).trim() !== '') {
    return String(reqBody.manufacturer_id).trim();
  }
  if (reqBody.manufacturer != null && String(reqBody.manufacturer).trim() !== '') {
    return await findBrandIdByName(reqBody.manufacturer);
  }
  return existingManufacturerId ?? null;
}

async function enrichInsertRequestsWithBrandNames(rows) {
  if (!rows?.length) return rows || [];
  const ids = [...new Set(rows.map((r) => r.proposed_manufacturer_id).filter(Boolean))];
  if (!ids.length) return rows;
  const { data: brands } = await supabase.from('slot_catalog_brands').select('id,name').in('id', ids);
  const m = new Map((brands || []).map((b) => [b.id, b.name]));
  return rows.map((r) => ({
    ...r,
    proposed_manufacturer: m.get(r.proposed_manufacturer_id) ?? null,
  }));
}

function normOptionalStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normYearForDiff(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Comparación ítem actual vs proposed_patch para la cola admin (solo campos que cambian).
 */
function computeCatalogChangeFieldDiffs(item, patch, brandNameById) {
  const changes = [];
  if (!patch) return changes;

  const brandLabel = (id) => {
    if (id == null || id === '') return '—';
    const s = String(id);
    return brandNameById.get(s) ?? s;
  };

  if (item) {
    const curM = String(item.manufacturer_id ?? '');
    const nextM = String(patch.manufacturer_id ?? item.manufacturer_id ?? '');
    if (curM !== nextM) {
      changes.push({
        field: 'manufacturer_id',
        label: 'Marca',
        before: brandLabel(curM),
        after: brandLabel(nextM),
      });
    }
  }

  const curModel = item ? normOptionalStr(item.model_name) : null;
  const propModel = normOptionalStr(patch.model_name);
  if (item && curModel !== propModel) {
    changes.push({
      field: 'model_name',
      label: 'Nombre / modelo',
      before: curModel ?? '—',
      after: propModel ?? '—',
    });
  }

  const curVt = item ? normOptionalStr(item.vehicle_type) : null;
  const propVt = normOptionalStr(patch.vehicle_type);
  if (item && curVt !== propVt) {
    changes.push({ field: 'vehicle_type', label: 'Tipo', before: curVt ?? '—', after: propVt ?? '—' });
  }

  const curTr = item ? normOptionalStr(item.traction) : null;
  const propTr = normOptionalStr(patch.traction);
  if (item && curTr !== propTr) {
    changes.push({ field: 'traction', label: 'Tracción', before: curTr ?? '—', after: propTr ?? '—' });
  }

  const curMp = item ? normOptionalStr(item.motor_position) : null;
  const propMp = normOptionalStr(patch.motor_position);
  if (item && curMp !== propMp) {
    changes.push({
      field: 'motor_position',
      label: 'Motor',
      before: curMp ?? '—',
      after: propMp ?? '—',
    });
  }

  const curY = item ? normYearForDiff(item.commercial_release_year) : null;
  const propY = normYearForDiff(patch.commercial_release_year);
  if (item && curY !== propY) {
    changes.push({
      field: 'commercial_release_year',
      label: 'Año',
      before: curY != null ? String(curY) : '—',
      after: propY != null ? String(propY) : '—',
    });
  }

  const curD = item ? Boolean(item.discontinued) : null;
  const propD = Boolean(patch.discontinued);
  if (item && curD !== propD) {
    changes.push({
      field: 'discontinued',
      label: 'Descatalogado',
      before: curD ? 'Sí' : 'No',
      after: propD ? 'Sí' : 'No',
    });
  }

  const curU = item ? Boolean(item.upcoming_release) : null;
  const propU = Boolean(patch.upcoming_release);
  if (item && curU !== propU) {
    changes.push({
      field: 'upcoming_release',
      label: 'Próximo lanzamiento',
      before: curU ? 'Sí' : 'No',
      after: propU ? 'Sí' : 'No',
    });
  }

  const curDorsal = item ? normOptionalStr(item.dorsal) : null;
  const propDorsal = normOptionalStr(patch.dorsal);
  if (item && curDorsal !== propDorsal) {
    changes.push({
      field: 'dorsal',
      label: 'Dorsal',
      before: curDorsal ?? '—',
      after: propDorsal ?? '—',
    });
  }

  const curLe = item ? Boolean(item.limited_edition) : null;
  const propLe = Boolean(patch.limited_edition);
  if (item && curLe !== propLe) {
    changes.push({
      field: 'limited_edition',
      label: 'Edición limitada',
      before: curLe ? 'Sí' : 'No',
      after: propLe ? 'Sí' : 'No',
    });
  }

  const curLt = item && item.limited_edition_total != null ? Number(item.limited_edition_total) : null;
  const propLt =
    patch.limited_edition_total !== undefined && patch.limited_edition_total !== null && patch.limited_edition_total !== ''
      ? parseCatalogLimitedEditionTotal(patch.limited_edition_total)
      : null;
  if (item && curLt !== propLt) {
    changes.push({
      field: 'limited_edition_total',
      label: 'Tirada (ed. limitada)',
      before: curLt != null ? String(curLt) : '—',
      after: propLt != null ? String(propLt) : '—',
    });
  }

  const curImg = item ? normOptionalStr(item.image_url) : null;
  const propImg = normOptionalStr(patch.image_url);
  if (item && curImg !== propImg) {
    changes.push({
      field: 'image_url',
      label: 'Imagen',
      before: curImg,
      after: propImg,
      kind: 'image',
    });
  }

  return changes;
}

/** Si el ítem ya no existe, igual mostramos los valores pretendidos en la cola. */
function proposedPatchToFallbackDiffs(patch, brandNameById) {
  const changes = [];
  if (!patch) return changes;
  const bl = (id) => {
    if (id == null || id === '') return '—';
    return brandNameById.get(String(id)) ?? String(id);
  };
  if (patch.manufacturer_id != null && String(patch.manufacturer_id).trim() !== '') {
    changes.push({
      field: 'manufacturer_id',
      label: 'Marca',
      before: '—',
      after: bl(patch.manufacturer_id),
    });
  }
  if (patch.model_name != null && String(patch.model_name).trim() !== '') {
    changes.push({
      field: 'model_name',
      label: 'Nombre / modelo',
      before: '—',
      after: String(patch.model_name).trim(),
    });
  }
  const vt = normOptionalStr(patch.vehicle_type);
  if (vt) changes.push({ field: 'vehicle_type', label: 'Tipo', before: '—', after: vt });
  const tr = normOptionalStr(patch.traction);
  if (tr) changes.push({ field: 'traction', label: 'Tracción', before: '—', after: tr });
  const mp = normOptionalStr(patch.motor_position);
  if (mp) changes.push({ field: 'motor_position', label: 'Motor', before: '—', after: mp });
  const y = normYearForDiff(patch.commercial_release_year);
  if (y != null) {
    changes.push({
      field: 'commercial_release_year',
      label: 'Año',
      before: '—',
      after: String(y),
    });
  }
  if (patch.discontinued !== undefined) {
    changes.push({
      field: 'discontinued',
      label: 'Descatalogado',
      before: '—',
      after: patch.discontinued ? 'Sí' : 'No',
    });
  }
  if (patch.upcoming_release !== undefined) {
    changes.push({
      field: 'upcoming_release',
      label: 'Próximo lanzamiento',
      before: '—',
      after: patch.upcoming_release ? 'Sí' : 'No',
    });
  }
  const d0 = normOptionalStr(patch.dorsal);
  if (d0) {
    changes.push({ field: 'dorsal', label: 'Dorsal', before: '—', after: d0 });
  }
  if (patch.limited_edition !== undefined) {
    changes.push({
      field: 'limited_edition',
      label: 'Edición limitada',
      before: '—',
      after: patch.limited_edition ? 'Sí' : 'No',
    });
  }
  const lt0 = parseCatalogLimitedEditionTotal(patch.limited_edition_total);
  if (lt0 != null) {
    changes.push({
      field: 'limited_edition_total',
      label: 'Tirada (ed. limitada)',
      before: '—',
      after: String(lt0),
    });
  }
  const img = normOptionalStr(patch.image_url);
  if (img) {
    changes.push({
      field: 'image_url',
      label: 'Imagen',
      before: null,
      after: img,
      kind: 'image',
    });
  }
  return changes;
}

const CATALOG_ITEM_SUMMARY_SELECT =
  'id, reference, manufacturer_id, manufacturer, model_name, vehicle_type, traction, motor_position, commercial_release_year, discontinued, upcoming_release, dorsal, limited_edition, limited_edition_total, image_url';

async function fetchChangeRequestCatalogItemsById(rows) {
  const itemIds = [...new Set(rows.map((r) => r.catalog_item_id).filter(Boolean))];
  let itemsById = new Map();
  if (itemIds.length) {
    const { data: items, error } = await supabase
      .from('slot_catalog_items_with_ratings')
      .select(CATALOG_ITEM_SUMMARY_SELECT)
      .in('id', itemIds);
    if (error) {
      console.warn('[catalog] fetchChangeRequestCatalogItemsById', error.message);
    } else {
      itemsById = new Map((items || []).map((it) => [it.id, it]));
    }
  }
  return itemsById;
}

function toCatalogItemSummary(item) {
  if (!item) return null;
  return {
    id: item.id,
    reference: item.reference ?? null,
    manufacturer: item.manufacturer ?? null,
    model_name: item.model_name ?? null,
  };
}

/**
 * Resumen de ficha para listados (p. ej. GET /my-requests).
 */
async function attachCatalogItemSummariesToChangeRequests(rows) {
  if (!rows?.length) return rows || [];
  const itemsById = await fetchChangeRequestCatalogItemsById(rows);
  return rows.map((r) => ({
    ...r,
    catalog_item_summary: toCatalogItemSummary(itemsById.get(r.catalog_item_id) ?? null),
  }));
}

/**
 * Añade resumen del ítem y lista de cambios respecto al estado actual (admin).
 */
async function enrichChangeRequestsForAdmin(rows) {
  if (!rows?.length) return rows || [];
  const itemsById = await fetchChangeRequestCatalogItemsById(rows);

  const brandIds = new Set();
  for (const r of rows) {
    const it = itemsById.get(r.catalog_item_id);
    if (it?.manufacturer_id) brandIds.add(String(it.manufacturer_id));
    const p = r.proposed_patch;
    if (p?.manufacturer_id) brandIds.add(String(p.manufacturer_id));
  }
  let brandNameById = new Map();
  if (brandIds.size) {
    const { data: brands } = await supabase.from('slot_catalog_brands').select('id,name').in('id', [...brandIds]);
    brandNameById = new Map((brands || []).map((b) => [String(b.id), b.name]));
  }

  return rows.map((r) => {
    const item = itemsById.get(r.catalog_item_id) ?? null;
    const field_diffs = item
      ? computeCatalogChangeFieldDiffs(item, r.proposed_patch, brandNameById)
      : proposedPatchToFallbackDiffs(r.proposed_patch, brandNameById);
    return {
      ...r,
      catalog_item_summary: toCatalogItemSummary(item),
      field_diffs,
    };
  });
}

/**
 * Email del usuario que envió la solicitud (requiere SUPABASE_SERVICE_ROLE_KEY).
 */
async function attachSubmitterEmails(rows) {
  if (!rows?.length) return rows || [];
  const adminClient = getServiceClient();
  if (!adminClient) {
    return rows.map((r) => ({ ...r, submitter_email: null }));
  }
  const ids = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
  const emailById = new Map();
  await Promise.all(
    ids.map(async (uid) => {
      try {
        const { data, error } = await adminClient.auth.admin.getUserById(uid);
        if (!error && data?.user?.email) {
          emailById.set(uid, data.user.email);
        }
      } catch (err) {
        console.warn('[catalog] submitter email', uid, err.message);
      }
    }),
  );
  return rows.map((r) => ({
    ...r,
    submitter_email: r.submitted_by ? emailById.get(r.submitted_by) ?? null : null,
  }));
}

router.use(authMiddleware);

/**
 * GET /stats — métricas de completitud y huecos (solo admin)
 */
router.get('/stats', adminGuard, async (req, res) => {
  try {
    const rows = await fetchAllSlotCatalogRowsForStats();
    const stats = computeCatalogDashboardStats(rows);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
    const sel =
      'id, reference, manufacturer_id, manufacturer, manufacturer_logo_url, model_name, vehicle_type, traction, motor_position, commercial_release_year, discontinued, upcoming_release, dorsal, limited_edition, limited_edition_total, image_url';
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('slot_catalog_items_with_ratings').select(sel).ilike('reference', pattern).limit(20),
      supabase.from('slot_catalog_items_with_ratings').select(sel).ilike('manufacturer', pattern).limit(20),
      supabase.from('slot_catalog_items_with_ratings').select(sel).ilike('model_name', pattern).limit(20),
      supabase.from('slot_catalog_items_with_ratings').select(sel).ilike('vehicle_type', pattern).limit(20),
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
          'id, proposed_reference, proposed_manufacturer_id, proposed_model_name, proposed_vehicle_type, proposed_traction, proposed_motor_position, proposed_commercial_release_year, proposed_discontinued, proposed_upcoming_release, proposed_dorsal, proposed_limited_edition, proposed_limited_edition_total, status, created_at, reviewed_at, rejection_reason, created_catalog_item_id',
        )
        .eq('submitted_by', uid)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (chg.error) return res.status(500).json({ error: chg.error.message });
    if (ins.error) return res.status(500).json({ error: ins.error.message });
    const changeRows = await attachCatalogItemSummariesToChangeRequests(chg.data ?? []);
    const insertRows = await enrichInsertRequestsWithBrandNames(ins.data ?? []);
    res.json({
      change_requests: changeRows,
      insert_requests: insertRows,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /items/:catalogItemId/rating/mine
 */
router.get('/items/:catalogItemId/rating/mine', async (req, res) => {
  try {
    const { catalogItemId } = req.params;
    if (!isUuid(catalogItemId)) {
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }
    const { data: row, error } = await supabase
      .from('slot_catalog_ratings')
      .select('rating')
      .eq('catalog_item_id', catalogItemId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ rating: row?.rating ?? null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /items/:catalogItemId/rating — body { rating: 1..5 }
 */
router.put('/items/:catalogItemId/rating', catalogContributionsLimiter, async (req, res) => {
  try {
    const { catalogItemId } = req.params;
    if (!isUuid(catalogItemId)) {
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }
    const rating = parseRatingBody(req.body?.rating);
    if (rating == null) {
      return res.status(400).json({ error: 'rating debe ser un entero entre 1 y 5' });
    }

    const { data: item, error: iErr } = await supabase
      .from('slot_catalog_items')
      .select('id')
      .eq('id', catalogItemId)
      .maybeSingle();
    if (iErr) return res.status(500).json({ error: iErr.message });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('slot_catalog_ratings')
      .select('catalog_item_id')
      .eq('catalog_item_id', catalogItemId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    let data;
    let error;
    if (existing) {
      ({ data, error } = await supabase
        .from('slot_catalog_ratings')
        .update({ rating, updated_at: now })
        .eq('catalog_item_id', catalogItemId)
        .eq('user_id', req.user.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('slot_catalog_ratings')
        .insert([
          {
            catalog_item_id: catalogItemId,
            user_id: req.user.id,
            rating,
            updated_at: now,
          },
        ])
        .select()
        .single());
    }

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, rating: data.rating });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /items/:catalogItemId/rating
 */
router.delete('/items/:catalogItemId/rating', catalogContributionsLimiter, async (req, res) => {
  try {
    const { catalogItemId } = req.params;
    if (!isUuid(catalogItemId)) {
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }
    const { error } = await supabase
      .from('slot_catalog_ratings')
      .delete()
      .eq('catalog_item_id', catalogItemId)
      .eq('user_id', req.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /items — paginación
 */
router.get('/items', adminGuard, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const refFilter = String(req.query.reference ?? '').trim();
    const manufacturerId = String(req.query.manufacturer_id ?? '').trim();
    const mfgFilter = String(req.query.manufacturer ?? '').trim();
    /** Hueco de datos: solo ítems que carecen de ese campo (alineado con métricas del dashboard). */
    const missing = String(req.query.missing ?? '').trim().toLowerCase();

    let q = supabase.from('slot_catalog_items_with_ratings').select('*', { count: 'exact' });
    if (refFilter) {
      const p = `%${escapeIlikePattern(refFilter)}%`;
      q = q.ilike('reference', p);
    }
    if (manufacturerId && isUuid(manufacturerId)) {
      q = q.eq('manufacturer_id', manufacturerId);
    } else if (mfgFilter) {
      const p = `%${escapeIlikePattern(mfgFilter)}%`;
      q = q.ilike('manufacturer', p);
    }
    if (missing === 'image') {
      q = q.or('image_url.is.null,image_url.eq.');
    } else if (missing === 'vehicle_type') {
      q = q.or('vehicle_type.is.null,vehicle_type.eq.');
    } else if (missing === 'traction') {
      q = q.or('traction.is.null,traction.eq.');
    } else if (missing === 'motor' || missing === 'motor_position') {
      q = q.or('motor_position.is.null,motor_position.eq.');
    } else if (missing === 'year') {
      q = q.or(
        'commercial_release_year.is.null,commercial_release_year.lt.1900,commercial_release_year.gt.2100',
      );
    } else if (missing === 'dorsal') {
      q = q.or('dorsal.is.null,dorsal.eq.');
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
router.get('/items/:id', adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('slot_catalog_items_with_ratings').select('*').eq('id', id).maybeSingle();
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
router.post('/items', adminGuard, itemUpload, async (req, res) => {
  try {
    const reference = normalizeReference(req.body.reference);
    const model_name = String(req.body.model_name ?? '').trim();
    const manufacturer_id = await resolveManufacturerIdFromBody(req.body, null);
    const vehicle_type = parseOptionalVehicleType(req.body.vehicle_type);
    const traction = parseOptionalTraction(req.body.traction);
    const motor_position = parseOptionalMotorPosition(req.body.motor_position);
    const commercial_release_year = parseYearFromBody(
      req.body.commercial_release_year ?? req.body.commercial_release_date,
    );
    const discontinued = parseBodyBool(req.body.discontinued);
    const upcoming_release = parseBodyBool(req.body.upcoming_release);
    const dorsal = normCatalogDorsal(req.body.dorsal);
    let limited_edition = parseBodyBool(req.body.limited_edition);
    let limited_edition_total = parseCatalogLimitedEditionTotal(req.body.limited_edition_total);
    if (!limited_edition) limited_edition_total = null;

    if (!reference || !manufacturer_id || !model_name) {
      return res.status(400).json({
        error: 'reference, manufacturer_id (o manufacturer) y model_name son obligatorios',
      });
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

    const { data: insRow, error } = await supabase
      .from('slot_catalog_items')
      .insert([
        {
          reference,
          manufacturer_id,
          model_name,
          vehicle_type,
          traction,
          motor_position,
          commercial_release_year,
          discontinued,
          upcoming_release,
          dorsal,
          limited_edition,
          limited_edition_total,
          image_url,
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un ítem con esa referencia y marca' });
      }
      return res.status(500).json({ error: error.message });
    }
    const { data: full } = await supabase
      .from('slot_catalog_items_with_ratings')
      .select('*')
      .eq('id', insRow.id)
      .maybeSingle();
    res.status(201).json(full || insRow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /items/:id
 */
router.put('/items/:id', adminGuard, itemUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: existing, error: exErr } = await supabase.from('slot_catalog_items').select('*').eq('id', id).maybeSingle();
    if (exErr) return res.status(500).json({ error: exErr.message });
    if (!existing) return res.status(404).json({ error: 'Ítem no encontrado' });

    const reference = req.body.reference != null ? normalizeReference(req.body.reference) : existing.reference;
    const manufacturer_id = await resolveManufacturerIdFromBody(req.body, existing.manufacturer_id);
    const model_name = req.body.model_name != null ? String(req.body.model_name).trim() : existing.model_name;
    const vehicle_type =
      req.body.vehicle_type !== undefined
        ? parseOptionalVehicleType(req.body.vehicle_type)
        : existing.vehicle_type;
    const commercial_release_year =
      req.body.commercial_release_year !== undefined || req.body.commercial_release_date !== undefined
        ? parseYearFromBody(req.body.commercial_release_year ?? req.body.commercial_release_date)
        : existing.commercial_release_year;
    const traction =
      req.body.traction !== undefined ? parseOptionalTraction(req.body.traction) : existing.traction;
    const motor_position =
      req.body.motor_position !== undefined
        ? parseOptionalMotorPosition(req.body.motor_position)
        : existing.motor_position;
    const discontinued =
      req.body.discontinued !== undefined
        ? parseBodyBool(req.body.discontinued)
        : Boolean(existing.discontinued);
    const upcoming_release =
      req.body.upcoming_release !== undefined
        ? parseBodyBool(req.body.upcoming_release)
        : Boolean(existing.upcoming_release);
    const dorsal =
      req.body.dorsal !== undefined ? normCatalogDorsal(req.body.dorsal) : normCatalogDorsal(existing.dorsal);
    let limited_edition =
      req.body.limited_edition !== undefined
        ? parseBodyBool(req.body.limited_edition)
        : Boolean(existing.limited_edition);
    let limited_edition_total =
      req.body.limited_edition_total !== undefined
        ? parseCatalogLimitedEditionTotal(req.body.limited_edition_total)
        : parseCatalogLimitedEditionTotal(existing.limited_edition_total);
    if (!limited_edition) limited_edition_total = null;

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

    if (!manufacturer_id) {
      return res.status(400).json({ error: 'manufacturer_id inválido o marca no encontrada' });
    }

    const { error } = await supabase
      .from('slot_catalog_items')
      .update({
        reference,
        manufacturer_id,
        model_name,
        vehicle_type,
        traction,
        motor_position,
        commercial_release_year,
        discontinued,
        upcoming_release,
        dorsal,
        limited_edition,
        limited_edition_total,
        image_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un ítem con esa referencia y marca' });
      }
      return res.status(500).json({ error: error.message });
    }
    const { data: full } = await supabase.from('slot_catalog_items_with_ratings').select('*').eq('id', id).maybeSingle();
    res.json(full);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /items/:id
 */
router.delete('/items/:id', adminGuard, async (req, res) => {
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
router.post('/items/:catalogItemId/change-requests', catalogContributionsLimiter, changeUpload, async (req, res) => {
  try {
    const { catalogItemId } = req.params;
    const { data: item, error: iErr } = await supabase.from('slot_catalog_items').select('*').eq('id', catalogItemId).maybeSingle();
    if (iErr) return res.status(500).json({ error: iErr.message });
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });

    let proposed_manufacturer_id = item.manufacturer_id;
    if (req.body.manufacturer_id != null && String(req.body.manufacturer_id).trim() !== '') {
      proposed_manufacturer_id = String(req.body.manufacturer_id).trim();
    } else if (req.body.manufacturer != null && String(req.body.manufacturer).trim() !== '') {
      const fid = await findBrandIdByName(req.body.manufacturer);
      if (fid) proposed_manufacturer_id = fid;
    }

    const proposed_patch = {
      manufacturer_id: proposed_manufacturer_id,
      model_name: req.body.model_name != null ? String(req.body.model_name).trim() : item.model_name,
      vehicle_type:
        req.body.vehicle_type !== undefined
          ? parseOptionalVehicleType(req.body.vehicle_type)
          : item.vehicle_type,
      traction: req.body.traction !== undefined ? parseOptionalTraction(req.body.traction) : item.traction,
      motor_position:
        req.body.motor_position !== undefined
          ? parseOptionalMotorPosition(req.body.motor_position)
          : item.motor_position,
      commercial_release_year:
        req.body.commercial_release_year !== undefined || req.body.commercial_release_date !== undefined
          ? parseYearFromBody(req.body.commercial_release_year ?? req.body.commercial_release_date)
          : item.commercial_release_year,
      discontinued:
        req.body.discontinued !== undefined ? parseBodyBool(req.body.discontinued) : Boolean(item.discontinued),
      upcoming_release:
        req.body.upcoming_release !== undefined
          ? parseBodyBool(req.body.upcoming_release)
          : Boolean(item.upcoming_release),
      dorsal:
        req.body.dorsal !== undefined ? normCatalogDorsal(req.body.dorsal) : normCatalogDorsal(item.dorsal),
      limited_edition:
        req.body.limited_edition !== undefined
          ? parseBodyBool(req.body.limited_edition)
          : Boolean(item.limited_edition),
      limited_edition_total: (() => {
        let le =
          req.body.limited_edition !== undefined
            ? parseBodyBool(req.body.limited_edition)
            : Boolean(item.limited_edition);
        let lt =
          req.body.limited_edition_total !== undefined
            ? parseCatalogLimitedEditionTotal(req.body.limited_edition_total)
            : parseCatalogLimitedEditionTotal(item.limited_edition_total);
        if (!le) lt = null;
        return lt;
      })(),
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

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'Ya tienes una solicitud de cambio pendiente para este ítem. Espera a que el equipo la revise.',
        });
      }
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /change-requests?status=pending
 */
router.get('/change-requests', adminGuard, async (req, res) => {
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
    const enriched = await enrichChangeRequestsForAdmin(data ?? []);
    const withEmail = await attachSubmitterEmails(enriched);
    res.json({ requests: withEmail });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /change-requests/:requestId/approve
 */
router.post('/change-requests/:requestId/approve', adminGuard, async (req, res) => {
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
        manufacturer_id:
          patch.manufacturer_id !== undefined && patch.manufacturer_id !== null
            ? String(patch.manufacturer_id)
            : item.manufacturer_id,
        model_name: patch.model_name ?? item.model_name,
        vehicle_type: patch.vehicle_type !== undefined ? patch.vehicle_type : item.vehicle_type,
        traction: patch.traction !== undefined ? patch.traction : item.traction,
        motor_position:
          patch.motor_position !== undefined
            ? parseOptionalMotorPosition(patch.motor_position)
            : item.motor_position,
        commercial_release_year: resolveCatalogYearFromPatch(patch, item),
        discontinued: patch.discontinued !== undefined ? Boolean(patch.discontinued) : Boolean(item.discontinued),
        upcoming_release:
          patch.upcoming_release !== undefined ? Boolean(patch.upcoming_release) : Boolean(item.upcoming_release),
        dorsal: patch.dorsal !== undefined ? normCatalogDorsal(patch.dorsal) : normCatalogDorsal(item.dorsal),
        limited_edition:
          patch.limited_edition !== undefined ? Boolean(patch.limited_edition) : Boolean(item.limited_edition),
        limited_edition_total: (() => {
          const le =
            patch.limited_edition !== undefined ? Boolean(patch.limited_edition) : Boolean(item.limited_edition);
          const lt =
            patch.limited_edition_total !== undefined
              ? parseCatalogLimitedEditionTotal(patch.limited_edition_total)
              : parseCatalogLimitedEditionTotal(item.limited_edition_total);
          return le ? lt : null;
        })(),
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
router.post('/change-requests/:requestId/reject', adminGuard, async (req, res) => {
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
router.post('/insert-requests', catalogContributionsLimiter, insertUpload, async (req, res) => {
  try {
    const proposed_reference = normalizeReference(req.body.proposed_reference ?? req.body.reference);
    const proposed_model_name = String(req.body.proposed_model_name ?? req.body.model_name ?? '').trim();
    const proposed_manufacturer_id = await resolveManufacturerIdFromBody(
      {
        manufacturer_id: req.body.proposed_manufacturer_id ?? req.body.manufacturer_id,
        manufacturer: req.body.proposed_manufacturer ?? req.body.manufacturer,
      },
      null,
    );
    const proposed_vehicle_type = parseOptionalVehicleType(
      req.body.proposed_vehicle_type ?? req.body.vehicle_type,
    );
    const proposed_traction = parseOptionalTraction(
      req.body.proposed_traction ?? req.body.traction,
    );
    const proposed_motor_position = parseOptionalMotorPosition(
      req.body.proposed_motor_position ?? req.body.motor_position,
    );
    const proposed_commercial_release_year = parseYearFromBody(
      req.body.proposed_commercial_release_year ??
        req.body.proposed_commercial_release_date ??
        req.body.commercial_release_date,
    );
    const proposed_discontinued = parseBodyBool(req.body.proposed_discontinued ?? req.body.discontinued);
    const proposed_upcoming_release = parseBodyBool(
      req.body.proposed_upcoming_release ?? req.body.upcoming_release,
    );
    const proposed_dorsal = normCatalogDorsal(req.body.proposed_dorsal ?? req.body.dorsal);
    let proposed_limited_edition = parseBodyBool(
      req.body.proposed_limited_edition ?? req.body.limited_edition,
    );
    let proposed_limited_edition_total = parseCatalogLimitedEditionTotal(
      req.body.proposed_limited_edition_total ?? req.body.limited_edition_total,
    );
    if (!proposed_limited_edition) proposed_limited_edition_total = null;

    if (!proposed_reference || !proposed_manufacturer_id || !proposed_model_name) {
      return res.status(400).json({
        error: 'reference, proposed_manufacturer_id (o marca por nombre) y model_name son obligatorios',
      });
    }

    const { data: existingItem } = await supabase
      .from('slot_catalog_items')
      .select('id')
      .eq('reference', proposed_reference)
      .eq('manufacturer_id', proposed_manufacturer_id)
      .maybeSingle();
    if (existingItem) {
      return res.status(409).json({
        error: 'Ya existe un ítem en el catálogo con esa referencia y marca. No es necesario proponer un alta.',
      });
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

    const { data: insRow, error } = await supabase
      .from('slot_catalog_insert_requests')
      .insert([
        {
          proposed_reference,
          proposed_manufacturer_id,
          proposed_model_name,
          proposed_vehicle_type,
          proposed_traction,
          proposed_motor_position,
          proposed_commercial_release_year,
          proposed_discontinued,
          proposed_upcoming_release,
          proposed_dorsal,
          proposed_limited_edition,
          proposed_limited_edition_total,
          proposed_image_url,
          submitted_by: req.user.id,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error:
            'Ya tienes una solicitud de alta pendiente para esa referencia y marca. Espera a que el equipo la revise.',
        });
      }
      return res.status(500).json({ error: error.message });
    }
    const enriched = await enrichInsertRequestsWithBrandNames([insRow]);
    res.status(201).json(enriched[0] || insRow);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /insert-requests?status=
 */
router.get('/insert-requests', adminGuard, async (req, res) => {
  try {
    const status = String(req.query.status || 'pending').toLowerCase();
    const ok = ['pending', 'approved', 'rejected', 'all'];
    const st = ok.includes(status) ? status : 'pending';
    let q = supabase.from('slot_catalog_insert_requests').select('*').order('created_at', { ascending: false }).limit(200);
    if (st !== 'all') q = q.eq('status', st);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const rows = await enrichInsertRequestsWithBrandNames(data ?? []);
    const withEmail = await attachSubmitterEmails(rows);
    res.json({ requests: withEmail });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /insert-requests/:requestId/approve
 */
router.post('/insert-requests/:requestId/approve', adminGuard, async (req, res) => {
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
          manufacturer_id: row.proposed_manufacturer_id,
          model_name: row.proposed_model_name,
          vehicle_type: row.proposed_vehicle_type ?? null,
          traction: row.proposed_traction ?? null,
          motor_position: row.proposed_motor_position ?? null,
          commercial_release_year: row.proposed_commercial_release_year ?? null,
          discontinued: Boolean(row.proposed_discontinued),
          upcoming_release: Boolean(row.proposed_upcoming_release),
          dorsal: normCatalogDorsal(row.proposed_dorsal),
          limited_edition: Boolean(row.proposed_limited_edition),
          limited_edition_total: (() => {
            const le = Boolean(row.proposed_limited_edition);
            const lt = parseCatalogLimitedEditionTotal(row.proposed_limited_edition_total);
            return le ? lt : null;
          })(),
          image_url: row.proposed_image_url,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (cErr) {
      if (cErr.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un ítem con esa referencia y marca en el catálogo' });
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
router.post('/insert-requests/:requestId/reject', adminGuard, async (req, res) => {
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
 * @param {Record<string, unknown>[]} rows
 * @param {string} duplicateMode
 * @param {(current: number, total: number) => void} [onProgress] current = filas ya procesadas
 */
async function runCatalogImportRows(rows, duplicateMode, onProgress) {
  const inserted = [];
  const updated = [];
  const skipped = [];
  const errors = [];
  const total = rows.length;
  if (onProgress) onProgress(0, total);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const ref = normalizeReference(r.reference ?? r.Reference ?? r.REFERENCIA ?? r.ref);
    const manufacturerRaw = normalizeManufacturer(r.manufacturer ?? r.Marca ?? r.fabricante ?? '');
    const manufacturer_id = await findBrandIdByName(manufacturerRaw);
    const model_name = String(r.model_name ?? r.model ?? r.nombre ?? r.Nombre ?? '').trim();
    const vehicle_type = parseOptionalVehicleType(
      r.vehicle_type ?? r.tipo ?? r.type ?? r.Tipo ?? '',
    );
    const traction = parseOptionalTraction(
      r.traction ?? r.tracción ?? r.Tracción ?? r.traccion ?? '',
    );
    const motor_position = parseMotorPositionFromImportCell(
      r.motor_position ?? r.posicion_motor ?? r.posición_motor ?? r.motor ?? '',
    );
    const commercial_release_year = parseYearFromImportCell(
      r.commercial_release_year ??
        r.commercial_release_date ??
        r.fecha ??
        r.release_date ??
        r.año ??
        r.year ??
        '',
    );
    const discontinued = parseOptionalBoolFromImportCell(
      r.discontinued ?? r.descatalogado ?? r.Descatalogado ?? '',
    );
    const upcoming_release = parseOptionalBoolFromImportCell(
      r.upcoming_release ?? r.proximo_lanzamiento ?? r['próximo_lanzamiento'] ?? r.próximo_lanzamiento ?? '',
    );
    const dorsal = normCatalogDorsal(
      catalogImportPick(r, ['dorsal', 'numero_dorsal', 'nº_dorsal', 'Numero dorsal', 'Dorsal']),
    );
    const leRaw = catalogImportPick(r, [
      'limited_edition',
      'edicion_limitada',
      'edición_limitada',
      'Edición limitada',
      'Edicion limitada',
    ]);
    let limited_edition = leRaw !== undefined ? parseOptionalBoolFromImportCell(leRaw) : false;
    const ltRaw = catalogImportPick(r, [
      'limited_edition_total',
      'tirada',
      'unidades_comercializadas',
      'Unidades comercializadas',
      'tirada_total',
    ]);
    let limited_edition_total = limited_edition ? parseCatalogLimitedEditionTotal(ltRaw) : null;

    if (!ref || !manufacturerRaw || !model_name) {
      errors.push({ row: rowNum, message: 'Faltan reference, manufacturer o model_name' });
      if (onProgress) onProgress(i + 1, total);
      continue;
    }

    if (!manufacturer_id) {
      errors.push({
        row: rowNum,
        message: `Marca no registrada en el catálogo: "${manufacturerRaw}". Créala en Marcas o usa el nombre exacto.`,
      });
      if (onProgress) onProgress(i + 1, total);
      continue;
    }

    const { data: existing } = await supabase
      .from('slot_catalog_items')
      .select('id')
      .eq('reference', ref)
      .eq('manufacturer_id', manufacturer_id)
      .maybeSingle();

    if (existing) {
      if (duplicateMode === 'skip') {
        skipped.push(ref);
        if (onProgress) onProgress(i + 1, total);
        continue;
      }
      if (duplicateMode === 'fail') {
        errors.push({ row: rowNum, message: `Referencia y marca duplicadas: ${ref} / ${manufacturerRaw}` });
        if (onProgress) onProgress(i + 1, total);
        continue;
      }
      const { error: upErr } = await supabase
        .from('slot_catalog_items')
        .update({
          manufacturer_id,
          model_name,
          vehicle_type,
          traction,
          motor_position,
          commercial_release_year,
          discontinued,
          upcoming_release,
          dorsal,
          limited_edition,
          limited_edition_total,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (upErr) errors.push({ row: rowNum, message: upErr.message });
      else updated.push(ref);
      if (onProgress) onProgress(i + 1, total);
      continue;
    }

    const { data: ins, error: insErr } = await supabase
      .from('slot_catalog_items')
      .insert([
        {
          reference: ref,
          manufacturer_id,
          model_name,
          vehicle_type,
          traction,
          motor_position,
          commercial_release_year,
          discontinued,
          upcoming_release,
          dorsal,
          limited_edition,
          limited_edition_total,
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
    if (onProgress) onProgress(i + 1, total);
  }

  return {
    inserted: inserted.length,
    updated: updated.length,
    skipped: skipped.length,
    insertedRefs: inserted,
    updatedRefs: updated,
    skippedRefs: skipped,
    errors,
  };
}

/**
 * POST /import — multipart: file, duplicateMode=skip|update|fail, sheetIndex (excel)
 * Respuesta: NDJSON (application/x-ndjson): líneas { type: 'progress', current, total } y cierre { type: 'complete', ... }.
 */
router.post('/import', adminGuard, upload.single('file'), async (req, res) => {
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
    } else if (isExcelImportFile(mime, name)) {
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
      return res.status(400).json({
        error:
          'Formato no soportado. Usa CSV o Excel (.xlsx, .xlsm, .xlsb, .xls, .xltx, .xltm).',
      });
    }

    if (rows.length > 0) {
      const normalized = normalizeBlankColumnHeaders(rows);
      rows = normalized.rows;
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');

    const result = await runCatalogImportRows(rows, duplicateMode, (current, total) => {
      res.write(`${JSON.stringify({ type: 'progress', current, total })}\n`);
    });
    res.write(`${JSON.stringify({ type: 'complete', ...result })}\n`);
    res.end();
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    } else {
      try {
        res.write(`${JSON.stringify({ type: 'error', message: e.message })}\n`);
        res.end();
      } catch (_) {
        /* ignore */
      }
    }
  }
});

const brandUpload = upload.fields([{ name: 'logo', maxCount: 1 }]);

/**
 * GET /brands — admin: listado completo con timestamps (misma fuente que público + metadatos)
 */
router.get('/brands', adminGuard, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('slot_catalog_brands')
      .select('id,name,logo_url,created_at,updated_at')
      .order('name', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ brands: data ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /brands — crear marca (multipart: name, logo opcional)
 */
router.post('/brands', adminGuard, brandUpload, async (req, res) => {
  try {
    const name = normalizeManufacturer(req.body.name);
    if (!name) return res.status(400).json({ error: 'name es obligatorio' });
    let logo_url = null;
    const logoFile = req.files?.logo?.[0];
    if (logoFile?.buffer) {
      logo_url = await uploadBrandLogoBuffer(supabase, logoFile.buffer, logoFile.mimetype || 'image/jpeg');
    }
    const { data, error } = await supabase
      .from('slot_catalog_brands')
      .insert([{ name, logo_url }])
      .select('id,name,logo_url,created_at,updated_at')
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una marca con ese nombre' });
      return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /brands/:id — actualizar nombre y/o logo (clear_logo=true quita logo y borra objeto)
 */
router.put('/brands/:id', adminGuard, brandUpload, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'Marca no encontrada' });
    const { data: existing, error: fetchErr } = await supabase.from('slot_catalog_brands').select('*').eq('id', id).maybeSingle();
    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!existing) return res.status(404).json({ error: 'Marca no encontrada' });

    const name = req.body.name !== undefined ? normalizeManufacturer(req.body.name) : existing.name;
    if (!name) return res.status(400).json({ error: 'name no puede estar vacío' });

    let logo_url = existing.logo_url;
    const clearLogo = parseBodyBool(req.body.clear_logo);
    if (clearLogo) {
      if (existing.logo_url) await removeCatalogObjectByPublicUrl(supabase, existing.logo_url);
      logo_url = null;
    }
    const logoFile = req.files?.logo?.[0];
    if (logoFile?.buffer) {
      if (existing.logo_url) await removeCatalogObjectByPublicUrl(supabase, existing.logo_url);
      logo_url = await uploadBrandLogoBuffer(supabase, logoFile.buffer, logoFile.mimetype || 'image/jpeg');
    }

    const { data, error } = await supabase
      .from('slot_catalog_brands')
      .update({ name, logo_url, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,name,logo_url,created_at,updated_at')
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una marca con ese nombre' });
      return res.status(500).json({ error: error.message });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /brands/:id — solo si no hay ítems ni solicitudes de alta que referencien la marca
 */
router.delete('/brands/:id', adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ error: 'Marca no encontrada' });
    const { count: itemCount, error: c1 } = await supabase
      .from('slot_catalog_items')
      .select('*', { count: 'exact', head: true })
      .eq('manufacturer_id', id);
    if (c1) return res.status(500).json({ error: c1.message });
    if ((itemCount ?? 0) > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: hay ítems del catálogo que usan esta marca' });
    }
    const { count: reqCount, error: c2 } = await supabase
      .from('slot_catalog_insert_requests')
      .select('*', { count: 'exact', head: true })
      .eq('proposed_manufacturer_id', id);
    if (c2) return res.status(500).json({ error: c2.message });
    if ((reqCount ?? 0) > 0) {
      return res.status(409).json({ error: 'No se puede eliminar: hay solicitudes de alta que referencian esta marca' });
    }
    const { data: brand } = await supabase.from('slot_catalog_brands').select('logo_url').eq('id', id).maybeSingle();
    if (!brand) return res.status(404).json({ error: 'Marca no encontrada' });
    const { error } = await supabase.from('slot_catalog_brands').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    if (brand.logo_url) await removeCatalogObjectByPublicUrl(supabase, brand.logo_url);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
