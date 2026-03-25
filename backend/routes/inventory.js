const express = require('express');
const { body } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { getOrCreateBaseSpecs, updateVehicleTotalPrice } = require('../lib/vehicleSpecs');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const ALLOWED_CATEGORIES = new Set([
  'pinion',
  'crown',
  'motor',
  'guide',
  'chassis',
  'front_wheel',
  'rear_wheel',
  'front_rim',
  'rear_rim',
  'front_axle',
  'rear_axle',
  'aceite',
  'limpiador',
  'electronica',
  'herramienta',
  'neumaticos',
  'cables',
  'suspension',
  'trencillas',
  'tornillos',
  'stoppers',
  'topes_y_centradores',
  'cojinetes',
  'otro',
]);

const ALLOWED_UNITS = new Set(['uds', 'pares', 'ml', 'metros', 'juego']);

router.use(authMiddleware);

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

async function assertVehicleOwned(vehicleId, userId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Inventario usa `otro`; componentes del vehículo usan `other`. */
function inventoryCategoryToComponentType(category) {
  const c = String(category);
  return c === 'otro' ? 'other' : c;
}

async function attachVehicles(rows, userId) {
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

/**
 * GET /api/inventory?category=&low_stock=true&vehicle_id=&q=
 */
router.get('/', async (req, res) => {
  try {
    const { category, low_stock: lowStock, vehicle_id: vehicleId, q } = req.query;

    let query = supabase
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

    const enriched = await attachVehicles(rows, req.user.id);
    res.json(enriched);
  } catch (err) {
    console.error('GET /inventory:', err);
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

    const { data: item, error: fetchErr } = await supabase
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

    const { data, error } = await supabase
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

    const { data: existing, error: fetchErr } = await supabase
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

    const { data: insertedHist, error: histErr } = await supabase
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

    const { data: updatedInv, error: updErr } = await supabase
      .from('inventory_items')
      .update(invUpdates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .eq('quantity', prevQty)
      .select('*')
      .maybeSingle();

    if (updErr || !updatedInv) {
      await supabase.from('inventory_purchase_history').delete().eq('id', insertedHist.id);
      return res.status(409).json({
        error:
          'No se pudo actualizar el stock (posible condición de carrera). Recarga e inténtalo de nuevo.',
      });
    }

    const [enriched] = await attachVehicles([updatedInv], req.user.id);
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
      const owned = await assertVehicleOwned(String(vehicleId), req.user.id);
      if (!owned) return res.status(404).json({ error: 'Vehículo no encontrado' });
      vId = String(vehicleId);
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
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('inventory_items').insert([row]).select('*').single();

    if (error) {
      console.error('Error al crear inventario:', error);
      return res.status(500).json({ error: error.message });
    }

    const [enriched] = await attachVehicles([data], req.user.id);
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

    const { data: existing, error: fetchErr } = await supabase
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
        const owned = await assertVehicleOwned(String(vid), req.user.id);
        if (!owned) return res.status(404).json({ error: 'Vehículo no encontrado' });
        updates.vehicle_id = String(vid);
      }
    }

    const { data, error } = await supabase
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

    const [enriched] = await attachVehicles([data], req.user.id);
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

    const { data: item, error: fetchErr } = await supabase
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
    if (Number(item.quantity) < 1) {
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

    const owned = await assertVehicleOwned(vehicleId, req.user.id);
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabase
      .from('components')
      .insert([row])
      .select('*')
      .single();

    if (insErr) {
      console.error('mount insert component:', insErr);
      return res.status(500).json({ error: insErr.message });
    }

    const prevQty = Number(item.quantity);
    const { data: updatedInv, error: updErr } = await supabase
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

    if (updErr || !updatedInv) {
      await supabase.from('components').delete().eq('id', inserted.id);
      return res.status(409).json({
        error:
          'No se pudo actualizar el stock (posible condición de carrera o stock agotado). Reintenta.',
      });
    }

    if (isModification) {
      await updateVehicleTotalPrice(vehicleId);
    }

    const [enriched] = await attachVehicles([updatedInv], req.user.id);
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

    const { data, error } = await supabase
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
