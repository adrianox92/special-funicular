const express = require('express');
const router = express.Router();
const { createUserScopedClient, getServiceClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { getCircuitRanking } = require('../lib/positionTracker');
const { insertVehicleTimingFromSyncBody } = require('../lib/vehicleTimingInsert');
const { formatSecondsToLapTime } = require('../lib/timingUtils');
const { parseSupplyVoltageVolts } = require('../lib/pilotProfileUtils');
const csvTimingParse = require('../lib/csvTimingParse');
const smartraceCsv = require('../lib/smartraceCsvImport');
const { fetchTimingIdsWithLaps } = require('../lib/timingLapsHelper');
// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);
router.use((req, res, next) => {
  req.supabase = createUserScopedClient(req.headers.authorization);
  next();
});

function parseNumber(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function csvRowToSyncBody(row, defaultVehicleId) {
  const vid = (row.vehicle_id && String(row.vehicle_id).trim()) || defaultVehicleId;
  if (!vid) {
    throw new Error('vehicle_id requerido (columna o parámetro de la petición)');
  }

  const lapsRaw = row.laps;
  const lapsN = parseInt(String(lapsRaw ?? '').replace(',', '.'), 10);
  if (!Number.isFinite(lapsN) || lapsN < 0) {
    throw new Error('laps inválido');
  }

  const bestTs = parseNumber(row.best_lap_timestamp);
  const totalTs = parseNumber(row.total_time_timestamp);
  const avgTs = parseNumber(row.average_time_timestamp);

  let best_lap_time = row.best_lap_time ? String(row.best_lap_time).trim() : '';
  let total_time = row.total_time ? String(row.total_time).trim() : '';
  let average_time = row.average_time ? String(row.average_time).trim() : '';

  if (!best_lap_time && bestTs != null) best_lap_time = formatSecondsToLapTime(bestTs);
  if (!total_time && totalTs != null) total_time = formatSecondsToLapTime(totalTs);
  if (!average_time && avgTs != null) average_time = formatSecondsToLapTime(avgTs);

  if (!best_lap_time || !total_time || !average_time) {
    throw new Error('Faltan best_lap_time/total_time/average_time (o sus *_timestamp)');
  }

  const lapKeys = Object.keys(row).filter((k) => /^lap_\d+$/i.test(k));
  lapKeys.sort((a, b) => {
    const ma = a.match(/\d+/);
    const mb = b.match(/\d+/);
    const na = ma ? parseInt(ma[0], 10) : 0;
    const nb = mb ? parseInt(mb[0], 10) : 0;
    return na - nb;
  });

  const lap_times = [];
  for (const k of lapKeys) {
    const numMatch = k.match(/\d+/);
    const num = numMatch ? parseInt(numMatch[0], 10) : lap_times.length + 1;
    const sec = parseNumber(row[k]);
    if (sec != null && sec > 0) {
      lap_times.push({ lap_number: num, time_seconds: sec, lap_time_seconds: sec });
    }
  }

  const circuitId = row.circuit_id && String(row.circuit_id).trim() ? String(row.circuit_id).trim() : null;

  return {
    vehicle_id: vid,
    best_lap_time,
    total_time,
    laps: lapsN,
    average_time,
    lane: row.lane && String(row.lane).trim() ? String(row.lane).trim() : null,
    circuit: row.circuit && String(row.circuit).trim() ? String(row.circuit).trim() : null,
    circuit_id: circuitId,
    timing_date: row.timing_date && String(row.timing_date).trim() ? String(row.timing_date).trim() : null,
    best_lap_timestamp: bestTs,
    total_time_timestamp: totalTs,
    average_time_timestamp: avgTs,
    lap_times: lap_times.length ? lap_times : undefined,
    scale_factor: row.scale_factor != null && String(row.scale_factor).trim() !== '' ? parseNumber(row.scale_factor) : undefined,
    supply_voltage_volts:
      row.supply_voltage_volts != null && String(row.supply_voltage_volts).trim() !== ''
        ? row.supply_voltage_volts
        : row.voltage != null && String(row.voltage).trim() !== ''
          ? row.voltage
          : undefined,
  };
}

function normalizeJsonTimingRow(row) {
  const o = { ...row };
  if (!o.best_lap_time && o.best_lap_timestamp != null) {
    o.best_lap_time = formatSecondsToLapTime(o.best_lap_timestamp);
  }
  if (!o.total_time && o.total_time_timestamp != null) {
    o.total_time = formatSecondsToLapTime(o.total_time_timestamp);
  }
  if (!o.average_time && o.average_time_timestamp != null) {
    o.average_time = formatSecondsToLapTime(o.average_time_timestamp);
  }
  return o;
}

/**
 * POST /api/timings/import-preview
 * Body: { format: "csv"|"json", content: string }
 * Respuesta: { format: "native"|"smartrace", rows: [{ index, pilotLabel, lapsExpected, error?, warning? }] }
 */
router.post('/import-preview', async (req, res) => {
  try {
    const { format, content } = req.body || {};
    if (content == null || typeof content !== 'string') {
      return res.status(400).json({ error: 'content (string) es requerido' });
    }
    if (!format || !['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'format debe ser "csv" o "json"' });
    }

    if (format === 'json') {
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(400).json({ error: 'JSON inválido' });
      }
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const rows = items.map((row, i) => {
        try {
          const merged = normalizeJsonTimingRow({ ...row });
          merged.vehicle_id = merged.vehicle_id || smartraceCsv.PREVIEW_VEHICLE_ID;
          if (!merged.vehicle_id) {
            throw new Error('vehicle_id requerido en cada objeto o en la petición');
          }
          if (merged.laps == null || merged.best_lap_time == null || merged.total_time == null || merged.average_time == null) {
            throw new Error('Faltan laps, best_lap_time, total_time o average_time');
          }
          const lapsN = parseInt(String(merged.laps).replace(',', '.'), 10);
          return {
            index: i,
            pilotLabel: '',
            lapsExpected: Number.isFinite(lapsN) ? lapsN : null,
            error: null,
          };
        } catch (e) {
          return {
            index: i,
            pilotLabel: '',
            lapsExpected: null,
            error: e.message,
          };
        }
      });
      return res.json({ format: 'native', rows });
    }

    const headers = csvTimingParse.csvHeadersNormalized(content);
    const objects = csvTimingParse.csvToObjects(content);
    if (objects.length === 0) {
      return res.status(400).json({ error: 'No hay filas para importar' });
    }

    if (smartraceCsv.isSmartRaceHeaders(headers)) {
      const smartraceMeta = smartraceCsv.getSmartRaceCsvMeta(headers, objects);
      const rows = objects.map((row, i) => {
        const p = smartraceCsv.previewSmartRaceRow(row, i);
        return {
          index: p.index,
          pilotLabel: p.pilotLabel,
          lapsExpected: p.lapsExpected,
          error: p.error,
          warning: p.warning || undefined,
        };
      });
      return res.json({ format: 'smartrace', rows, smartraceMeta });
    }

    const rows = objects.map((row, i) => {
      try {
        csvRowToSyncBody(row, smartraceCsv.PREVIEW_VEHICLE_ID);
        const lapsExpected = parseInt(String(row.laps ?? '').replace(',', '.'), 10);
        return {
          index: i,
          pilotLabel: '',
          lapsExpected: Number.isFinite(lapsExpected) ? lapsExpected : null,
          error: null,
        };
      } catch (e) {
        return {
          index: i,
          pilotLabel: '',
          lapsExpected: null,
          error: e.message,
        };
      }
    });
    return res.json({ format: 'native', rows });
  } catch (err) {
    console.error('POST /api/timings/import-preview:', err);
    res.status(500).json({ error: err.message || 'Error al generar vista previa' });
  }
});

/**
 * POST /api/timings/import
 * Body: { vehicle_id?, format: "csv"|"json", content: string, selected_row_indices?: number[] }
 * CSV: cabeceras timing_date, circuit, lane, laps, best_lap_time, total_time, average_time,
 *      best_lap_timestamp?, total_time_timestamp?, average_time_timestamp?, circuit_id?, supply_voltage_volts|voltage?, lap_1, lap_2, ...
 * CSV SmartRace: columnas tipo exportación SmartRace (vueltas, piloto, 1, 2, …); varias filas requieren selected_row_indices.
 * CSV SmartRace sin circuito/carril en el fichero: enviar circuit_id (y opcionalmente circuit) y lane según elección del usuario.
 * JSON: array de objetos (mismo esquema que POST /api/sync/timings); vehicle_id opcional si se envía arriba.
 */
router.post('/import', async (req, res) => {
  try {
    const {
      vehicle_id: defaultVehicleId,
      format,
      content,
      selected_row_indices,
      circuit_id: importCircuitId,
      circuit: importCircuitName,
      lane: importLane,
    } = req.body || {};
    if (content == null || typeof content !== 'string') {
      return res.status(400).json({ error: 'content (string) es requerido' });
    }
    if (!format || !['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'format debe ser "csv" o "json"' });
    }

    const selectedSet =
      Array.isArray(selected_row_indices) && selected_row_indices.length > 0
        ? new Set(selected_row_indices.map((x) => Number(x)))
        : null;

    let items = [];
    let csvFormat = null;
    let originalIndices = null;

    if (format === 'json') {
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return res.status(400).json({ error: 'JSON inválido' });
      }
      const all = Array.isArray(parsed) ? parsed : [parsed];
      if (selectedSet) {
        items = [];
        originalIndices = [];
        for (let j = 0; j < all.length; j++) {
          if (selectedSet.has(j)) {
            items.push(all[j]);
            originalIndices.push(j);
          }
        }
      } else {
        items = all;
        originalIndices = all.map((_, j) => j);
      }
    } else {
      const headers = csvTimingParse.csvHeadersNormalized(content);
      const objects = csvTimingParse.csvToObjects(content);
      if (objects.length === 0) {
        return res.status(400).json({ error: 'No hay filas para importar' });
      }

      if (smartraceCsv.isSmartRaceHeaders(headers)) {
        csvFormat = 'smartrace';
        if (objects.length > 1 && (!selectedSet || selectedSet.size === 0)) {
          return res.status(400).json({
            error:
              'Este CSV tiene varios pilotos. Obtén una vista previa (POST /api/timings/import-preview) y envía selected_row_indices con las filas a importar.',
          });
        }
        const useSet = selectedSet && selectedSet.size > 0 ? selectedSet : new Set([0]);
        items = [];
        originalIndices = [];
        for (let i = 0; i < objects.length; i++) {
          if (useSet.has(i)) {
            items.push(objects[i]);
            originalIndices.push(i);
          }
        }
        if (items.length === 0) {
          return res.status(400).json({ error: 'No hay filas seleccionadas para importar' });
        }
      } else {
        csvFormat = 'native';
        if (selectedSet) {
          items = [];
          originalIndices = [];
          for (let j = 0; j < objects.length; j++) {
            if (selectedSet.has(j)) {
              items.push(objects[j]);
              originalIndices.push(j);
            }
          }
        } else {
          items = objects;
          originalIndices = objects.map((_, j) => j);
        }
      }
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No hay filas para importar' });
    }

    const errors = [];
    let imported = 0;

    for (let i = 0; i < items.length; i++) {
      const sourceRowNumber = originalIndices ? originalIndices[i] + 1 : i + 1;
      let body;
      try {
        if (format === 'json') {
          const merged = normalizeJsonTimingRow(items[i]);
          merged.vehicle_id = merged.vehicle_id || defaultVehicleId;
          if (!merged.vehicle_id) {
            throw new Error('vehicle_id requerido en cada objeto o en la petición');
          }
          body = merged;
        } else if (csvFormat === 'smartrace') {
          const importOptions = {
            circuit_id: importCircuitId,
            circuit: importCircuitName,
            lane: importLane,
          };
          const merged = smartraceCsv.mergeSmartRaceRowWithImportOptions(items[i], importOptions);
          if (!smartraceCsv.hasCircuitInRow(merged)) {
            throw new Error(
              'Falta circuito: el CSV no lo incluye o está vacío. Selecciona un circuito en la importación o añade columnas circuit/circuito/circuit_id.'
            );
          }
          if (!smartraceCsv.hasLaneInRow(merged)) {
            throw new Error(
              'Falta carril: el CSV no lo incluye o está vacío. Selecciona un carril en la importación o añade columnas lane/carril.'
            );
          }
          body = smartraceCsv.smartRaceRowToSyncBody(merged, defaultVehicleId);
          delete body._smartraceWarning;
        } else {
          body = csvRowToSyncBody(items[i], defaultVehicleId);
        }
      } catch (e) {
        errors.push({ row: sourceRowNumber, error: e.message });
        continue;
      }

      const result = await insertVehicleTimingFromSyncBody(req.supabase, req.user.id, body);
      if (!result.success) {
        errors.push({ row: sourceRowNumber, error: result.error });
        continue;
      }
      imported += 1;
    }

    res.json({ imported, errors, total: items.length });
  } catch (err) {
    console.error('POST /api/timings/import:', err);
    res.status(500).json({ error: err.message || 'Error al importar' });
  }
});

/**
 * @swagger
 * /api/timings:
 *   get:
 *     summary: Obtiene todos los tiempos de todos los vehículos del usuario
 *     tags:
 *       - Tiempos
 *     parameters:
 *       - in: query
 *         name: circuit
 *         schema:
 *           type: string
 *         description: Filtrar por nombre de circuito
 *     responses:
 *       200:
 *         description: Lista de tiempos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
// Obtener todos los tiempos de todos los vehículos del usuario
router.get('/', async (req, res) => {
  try {
    const { circuit, circuit_id } = req.query;
    // Primero obtenemos todos los vehículos del usuario
    const { data: vehicles, error: vehiclesError } = await req.supabase
      .from('vehicles')
      .select('id, model, manufacturer')
      .eq('user_id', req.user.id);

    if (vehiclesError) {
      return res.status(500).json({ error: 'Error al obtener los vehículos' });
    }

    if (!vehicles || vehicles.length === 0) {
      return res.json([]);
    }

    // Obtenemos los IDs de los vehículos
    const vehicleIds = vehicles.map(v => v.id);

    // Creamos un mapa de vehículos para acceso rápido
    const vehiclesMap = vehicles.reduce((acc, vehicle) => {
      acc[vehicle.id] = vehicle;
      return acc;
    }, {});

    // Obtenemos todos los tiempos de los vehículos del usuario
    let timingsQuery = req.supabase
      .from('vehicle_timings')
      .select(`
        *,
        previous_position,
        position_change,
        position_updated_at,
        circuits(id, name, num_lanes, lane_lengths)
      `)
      .in('vehicle_id', vehicleIds)
      .order('timing_date', { ascending: false });
    if (circuit_id) {
      timingsQuery = timingsQuery.eq('circuit_id', circuit_id);
    } else if (circuit) {
      timingsQuery = timingsQuery.ilike('circuit', `%${circuit}%`);
    }
    const { data: timings, error: timingsError } = await timingsQuery;

    if (timingsError) {
      return res.status(500).json({ error: 'Error al obtener los tiempos' });
    }

    // Qué timings tienen vueltas en timing_laps (paginado: evita límite 1000 filas de PostgREST)
    const allTimingIds = timings.map(t => t.id).filter(Boolean);
    const timingsWithLapsSet = await fetchTimingIdsWithLaps(req.supabase, allTimingIds);

    // Enriquecer los tiempos con la información del vehículo y posiciones
    let enrichedTimings = timings.map(timing => ({
      ...timing,
      vehicle_model: vehiclesMap[timing.vehicle_id]?.model,
      vehicle_manufacturer: vehiclesMap[timing.vehicle_id]?.manufacturer,
      has_laps: timingsWithLapsSet.has(timing.id)
    }));

    // Obtener información de posiciones por circuito (en paralelo)
    const uniqueCircuits = [...new Set(timings.filter(t => t.circuit).map(t => t.circuit))];
    const circuitPositions = {};
    await Promise.all(uniqueCircuits.map(async (circuitName) => {
      try {
        const ranking = await getCircuitRanking(circuitName, req.supabase);
        circuitPositions[circuitName] = ranking;
      } catch (error) {
        console.warn(`[WARN] Error al obtener ranking del circuito ${circuitName}:`, error.message);
        circuitPositions[circuitName] = [];
      }
    }));

    // Enriquecer con información de posiciones
    enrichedTimings = enrichedTimings.map(timing => {
      if (timing.circuit && circuitPositions[timing.circuit]) {
        const circuitRanking = circuitPositions[timing.circuit];
        const rankingEntry = circuitRanking.find(entry => entry.vehicle_id === timing.vehicle_id);
        
        if (rankingEntry) {
          return {
            ...timing,
            circuit_ranking: {
              position: rankingEntry.current_position,
              previous_position: rankingEntry.previous_position,
              position_change: rankingEntry.position_change,
              position_status: rankingEntry.position_status,
              gap_to_leader: rankingEntry.gap_to_leader,
              gap_to_previous: rankingEntry.gap_to_previous
            }
          };
        }
      }
      
      return timing;
    });

    // Calcular diferencias
    // Ordenar por best_lap_time ascendente (mejor primero)
    enrichedTimings = enrichedTimings.sort((a, b) => {
      // Convertir a segundos para comparar
      const parseTime = (t) => {
        if (!t) return Infinity;
        const match = t.match(/^([0-9]{2}):([0-9]{2})\.([0-9]{3})$/);
        if (!match) return Infinity;
        const [, min, sec, ms] = match.map(Number);
        return min * 60 + sec + ms / 1000;
      };
      return parseTime(a.best_lap_time) - parseTime(b.best_lap_time);
    });
    let bestTime = null;
    let prevTime = null;
    enrichedTimings = enrichedTimings.map((timing, idx) => {
      const parseTime = (t) => {
        if (!t) return null;
        const match = t.match(/^([0-9]{2}):([0-9]{2})\.([0-9]{3})$/);
        if (!match) return null;
        const [, min, sec, ms] = match.map(Number);
        return min * 60 + sec + ms / 1000;
      };
      const thisTime = parseTime(timing.best_lap_time);
      if (idx === 0) {
        bestTime = thisTime;
        prevTime = thisTime;
        return {
          ...timing,
          time_diff: '—'
        };
      } else {
        const diffBest = (thisTime - bestTime).toFixed(3).padStart(6, '0');
        const diffPrev = (thisTime - prevTime).toFixed(3).padStart(6, '0');
        prevTime = thisTime;
        return {
          ...timing,
          time_diff: `${diffBest} (${diffPrev})`
        };
      }
    });

    res.json(enrichedTimings);
  } catch (err) {
    console.error('Error al obtener tiempos:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/timings/:id
 * Actualizar metadatos de una sesión (solo supply_voltage_volts por ahora).
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { supply_voltage_volts } = req.body || {};

    if (supply_voltage_volts === undefined) {
      return res.status(400).json({ error: 'supply_voltage_volts es requerido (o null para borrar)' });
    }

    const parsed = parseSupplyVoltageVolts(supply_voltage_volts);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const { data: timing, error: timingError } = await req.supabase
      .from('vehicle_timings')
      .select('id, vehicle_id')
      .eq('id', id)
      .single();

    if (timingError || !timing) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const { data: vehicle } = await req.supabase
      .from('vehicles')
      .select('id')
      .eq('id', timing.vehicle_id)
      .eq('user_id', req.user.id)
      .single();

    if (!vehicle) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const { data: updated, error: updateErr } = await req.supabase
      .from('vehicle_timings')
      .update({ supply_voltage_volts: parsed.volts })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }

    res.json(updated);
  } catch (err) {
    console.error('Error en PATCH /timings/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/timings/:id/laps
 * Get individual lap times for a timing session.
 */
router.get('/:id/laps', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: timing, error: timingError } = await req.supabase
      .from('vehicle_timings')
      .select('id, vehicle_id')
      .eq('id', id)
      .single();

    if (timingError || !timing) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const { data: vehicles } = await req.supabase
      .from('vehicles')
      .select('id')
      .eq('id', timing.vehicle_id)
      .eq('user_id', req.user.id)
      .single();

    if (!vehicles) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const lapsClient = getServiceClient() || req.supabase;
    const { data: laps, error: lapsError } = await lapsClient
      .from('timing_laps')
      .select('id, lap_number, lap_time_seconds, lap_time_text')
      .eq('timing_id', id)
      .order('lap_number', { ascending: true });

    if (lapsError) {
      return res.status(500).json({ error: lapsError.message });
    }

    res.json({ laps: laps || [] });
  } catch (err) {
    console.error('Error al obtener vueltas:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 