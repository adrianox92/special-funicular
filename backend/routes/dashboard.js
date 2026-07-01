const express = require('express');
const router = express.Router();
const { getAnonClient } = require('../lib/supabaseClients');
const authMiddleware = require('../middleware/auth');
const { modificationLineTotal } = require('../lib/componentPricing');
const { resolveStaleDaysThreshold } = require('../lib/userPreferences');
const { evaluateGoalProgress } = require('../lib/trainingGoals');
const { formatSecondsToLapTime } = require('../lib/timingUtils');

const supabase = getAnonClient();

/** TTL en memoria para deduplicar resúmenes de competición entre /metrics y /action-items. */
const COMPETITION_SUMMARY_TTL_MS = 30_000;
const competitionSummaryCache = new Map();

/**
 * @param {string} organizerId
 * @returns {Promise<Array>}
 */
async function getCompetitionProgressSummariesCached(organizerId) {
  const now = Date.now();
  const hit = competitionSummaryCache.get(organizerId);
  if (hit && now - hit.fetchedAt < COMPETITION_SUMMARY_TTL_MS) {
    return hit.data;
  }
  const data = await getCompetitionProgressSummaries(organizerId);
  competitionSummaryCache.set(organizerId, { fetchedAt: now, data });
  return data;
}

/**
 * Agrega rendimiento por tipo a partir de vehículos ya cargados (evita segunda query masiva).
 * @param {Array<object>} vehicles
 */
function computePerformanceByTypeFromVehicles(vehicles) {
  const typePerformance = {};
  (vehicles || []).forEach((vehicle) => {
    if (!vehicle.type) {
      return;
    }

    if (!typePerformance[vehicle.type]) {
      typePerformance[vehicle.type] = {
        total_time: 0,
        count: 0,
        vehicles: [],
      };
    }

    const validTimings =
      vehicle.vehicle_timings?.filter((t) => {
        const timeInSeconds = timeToSeconds(t.best_lap_time);
        return timeInSeconds !== null && timeInSeconds > 0;
      }) || [];

    if (validTimings.length > 0) {
      const bestTime = Math.min(...validTimings.map((t) => timeToSeconds(t.best_lap_time)));

      typePerformance[vehicle.type].total_time += bestTime;
      typePerformance[vehicle.type].count++;
      typePerformance[vehicle.type].vehicles.push({
        model: vehicle.model || 'Sin modelo',
        manufacturer: vehicle.manufacturer || 'Sin marca',
        best_time: Number(bestTime.toFixed(2)),
      });
    }
  });

  Object.keys(typePerformance).forEach((type) => {
    if (typePerformance[type].count > 0) {
      typePerformance[type].average_time = Number(
        (typePerformance[type].total_time / typePerformance[type].count).toFixed(2),
      );
      typePerformance[type].vehicles.sort((a, b) => a.best_time - b.best_time);
    }
  });

  return typePerformance;
}

/** Categorías de inventario consideradas críticas para alertas en dashboard. */
const CRITICAL_INVENTORY_CATEGORIES = new Set([
  'motor',
  'guide',
  'pinion',
  'crown',
  'neumaticos',
  'front_wheel',
  'rear_wheel',
  'axle',
]);

/**
 * Progreso de tiempos por competición (misma lógica que GET /competitions/:id/progress).
 * @returns {Promise<Array<{ id: string, name: string, rounds: number, circuit_name: string|null, created_at: string, participants_count: number, times_registered: number, total_required_times: number, times_remaining: number, is_completed: boolean }>>}
 */
async function getCompetitionProgressSummaries(organizerId) {
  const { data: competitions, error: compErr } = await supabase
    .from('competitions')
    .select('id, name, rounds, circuit_name, created_at')
    .eq('organizer', organizerId)
    .order('created_at', { ascending: false });

  if (compErr) {
    console.error('getCompetitionProgressSummaries competitions:', compErr);
    return [];
  }
  if (!competitions?.length) return [];

  const compIds = competitions.map((c) => c.id);
  const { data: participants, error: partErr } = await supabase
    .from('competition_participants')
    .select('id, competition_id')
    .in('competition_id', compIds);

  if (partErr) {
    console.error('getCompetitionProgressSummaries participants:', partErr);
    return [];
  }

  const participantToComp = new Map();
  const partsByComp = new Map();
  for (const p of participants || []) {
    participantToComp.set(p.id, p.competition_id);
    if (!partsByComp.has(p.competition_id)) partsByComp.set(p.competition_id, []);
    partsByComp.get(p.competition_id).push(p.id);
  }

  const allPartIds = (participants || []).map((p) => p.id);
  let timesPerComp = new Map();
  if (allPartIds.length > 0) {
    const { data: timings, error: timErr } = await supabase
      .from('competition_timings')
      .select('participant_id')
      .in('participant_id', allPartIds);

    if (timErr) {
      console.error('getCompetitionProgressSummaries timings:', timErr);
    } else {
      for (const t of timings || []) {
        const compId = participantToComp.get(t.participant_id);
        if (!compId) continue;
        timesPerComp.set(compId, (timesPerComp.get(compId) || 0) + 1);
      }
    }
  }

  return competitions.map((c) => {
    const participantsCount = partsByComp.get(c.id)?.length || 0;
    const timesRegistered = timesPerComp.get(c.id) || 0;
    const totalRequiredTimes = participantsCount * (c.rounds || 0);
    const isCompleted = totalRequiredTimes > 0 && timesRegistered >= totalRequiredTimes;
    const timesRemaining = Math.max(0, totalRequiredTimes - timesRegistered);
    return {
      id: c.id,
      name: c.name,
      rounds: c.rounds,
      circuit_name: c.circuit_name,
      created_at: c.created_at,
      participants_count: participantsCount,
      times_registered: timesRegistered,
      total_required_times: totalRequiredTimes,
      times_remaining: timesRemaining,
      is_completed: isCompleted,
    };
  });
}

function circuitSessionKey(row) {
  if (row.circuit_id) return `id:${row.circuit_id}`;
  const name = (row.circuit && String(row.circuit).trim()) || '';
  return `n:${name}`;
}

function circuitLabelFromKey(key, rowsSample) {
  if (!key) return null;
  if (key.startsWith('id:')) {
    const row = rowsSample.find((r) => r.circuit_id && `id:${r.circuit_id}` === key);
    if (row?.circuits?.name) return row.circuits.name;
  }
  const row = rowsSample.find((r) => circuitSessionKey(r) === key);
  if (row?.circuits?.name) return row.circuits.name;
  if (key.startsWith('n:')) return key.slice(2) || null;
  return key;
}

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Métricas opcionales por request (activar con DASHBOARD_PERF_LOG=1)
router.use((req, res, next) => {
  if (process.env.DASHBOARD_PERF_LOG !== '1') {
    return next();
  }
  const started = Date.now();
  const origJson = res.json.bind(res);
  res.json = function dashboardJsonMeter(payload) {
    const ms = Date.now() - started;
    let approxBytes = 0;
    try {
      approxBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    } catch (_) {
      /* ignore */
    }
    console.log(`[dashboard-perf] ${req.method} ${req.path} ${ms}ms ~${approxBytes}B`);
    return origJson(payload);
  };
  next();
});

// Función para formatear tiempo de segundos a mm:ss.ms
const formatTime = (seconds) => {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(3);
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
};

// Función para convertir tiempo de formato mm:ss.ms a segundos
const timeToSeconds = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const [minutes, seconds] = timeStr.split(':');
  if (!minutes || !seconds) return null;
  return Number(minutes) * 60 + Number(seconds);
};

// Función para calcular tendencias basadas en datos históricos
const calculateTrends = async (userId, options = {}) => {
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  try {
    let vehicles;
    if (Array.isArray(options.vehiclesForTrends)) {
      vehicles = options.vehiclesForTrends;
    } else {
      const { data: vdata, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(
          'id, model, manufacturer, price, total_price, modified, digital, museo, taller, purchase_date, created_at',
        )
        .eq('user_id', userId)
        .limit(500);

      if (vehiclesError) throw vehiclesError;
      vehicles = vdata || [];
    }

    // Calcular tendencias de vehículos
    const currentTotal = vehicles.length;
    const currentModified = vehicles.filter(v => v.modified).length;
    const currentStock = currentTotal - currentModified;

    // Vehículos añadidos en el último mes
    const lastMonthVehicles = vehicles.filter(v => {
      const purchaseDate = new Date(v.purchase_date || v.created_at);
      return purchaseDate >= oneMonthAgo;
    });

    const lastMonthDigital = lastMonthVehicles.filter((v) => v.digital).length;
    const lastMonthMuseo = lastMonthVehicles.filter((v) => v.museo).length;
    const lastMonthTaller = lastMonthVehicles.filter((v) => v.taller).length;

    // Vehículos modificados en el último mes (aproximado por created_at)
    const lastMonthModified = vehicles.filter(v => {
      const createdDate = new Date(v.created_at);
      return v.modified && createdDate >= oneMonthAgo;
    });

    // Calcular tendencia de inversión
    const currentInvestment = vehicles
      .filter(v => v.modified && v.total_price > v.price)
      .reduce((sum, v) => sum + (v.total_price - v.price), 0);

    const lastMonthInvestment = lastMonthVehicles
      .filter(v => v.modified && v.total_price > v.price)
      .reduce((sum, v) => sum + (v.total_price - v.price), 0);

    // Calcular incremento promedio anual
    const vehiclesWithIncrement = vehicles
      .filter(v => v.modified && v.price > 0 && v.total_price > v.price)
      .map(v => ({
        ...v,
        price_increment: ((v.total_price - v.price) / v.price * 100)
      }));

    const currentAvgIncrement = vehiclesWithIncrement.length > 0
      ? vehiclesWithIncrement.reduce((sum, v) => sum + v.price_increment, 0) / vehiclesWithIncrement.length
      : 0;

    // Obtener datos de tiempos para tendencias de rendimiento
    const { data: timings, error: timingsError } = await supabase
      .from('vehicle_timings')
      .select(`
        best_lap_time,
        timing_date,
        vehicles!inner (
          id,
          user_id
        )
      `)
      .eq('vehicles.user_id', userId)
      .gte('timing_date', oneMonthAgo.toISOString().split('T')[0]);

    if (timingsError) throw timingsError;

    // Calcular mejor tiempo reciente
    const recentBestTime = timings.length > 0 
      ? Math.min(...timings.map(t => timeToSeconds(t.best_lap_time)).filter(t => t !== null))
      : null;

    // Obtener mejor tiempo histórico para comparar
    const { data: historicalBestTime, error: historicalError } = await supabase
      .from('vehicle_timings')
      .select(`
        best_lap_time,
        timing_date,
        vehicles!inner (
          id,
          user_id
        )
      `)
      .eq('vehicles.user_id', userId)
      .lt('timing_date', oneMonthAgo.toISOString().split('T')[0])
      .order('best_lap_time', { ascending: true })
      .limit(1)
      .single();

    if (historicalError && historicalError.code !== 'PGRST116') throw historicalError;

    const historicalBest = historicalBestTime ? timeToSeconds(historicalBestTime.best_lap_time) : null;

    // Calcular tendencias
    const trends = {
      totalVehicles: {
        trend: lastMonthVehicles.length > 0 ? 'up' : 'stable',
        value: lastMonthVehicles.length > 0 ? `+${lastMonthVehicles.length} este mes` : 'Sin cambios'
      },
      modifiedVehicles: {
        trend: lastMonthModified.length > 0 ? 'up' : 'stable',
        value: lastMonthModified.length > 0 ? `+${lastMonthModified.length} esta semana` : 'Sin cambios'
      },
      stockVehicles: {
        trend: currentStock < (currentTotal - currentModified) ? 'down' : 'stable',
        value: currentStock < (currentTotal - currentModified) ? `-${(currentTotal - currentModified) - currentStock} este mes` : 'Sin cambios'
      },
      totalInvestment: {
        trend: lastMonthInvestment > 0 ? 'up' : 'stable',
        value: lastMonthInvestment > 0 ? `+${lastMonthInvestment.toFixed(0)}€ este mes` : 'Sin cambios'
      },
      averagePriceIncrement: {
        trend: currentAvgIncrement > 0 ? 'up' : 'stable',
        value: currentAvgIncrement > 0 ? `+${currentAvgIncrement.toFixed(1)}% este año` : 'Sin cambios'
      },
      bestTime: {
        trend: recentBestTime && historicalBest ? 
          (recentBestTime < historicalBest ? 'up' : recentBestTime > historicalBest ? 'down' : 'stable') : 'stable',
        value: recentBestTime && historicalBest ? 
          (recentBestTime < historicalBest ? 'Nuevo récord' : recentBestTime > historicalBest ? 'Más lento' : 'Récord estable') : 'Sin datos'
      },
      lastUpdate: {
        trend: 'stable',
        value: 'Sistema activo'
      },
      digitalVehicles: {
        trend: lastMonthDigital > 0 ? 'up' : 'stable',
        value: lastMonthDigital > 0 ? `+${lastMonthDigital} este mes` : 'Sin cambios',
      },
      museoVehicles: {
        trend: lastMonthMuseo > 0 ? 'up' : 'stable',
        value: lastMonthMuseo > 0 ? `+${lastMonthMuseo} este mes` : 'Sin cambios',
      },
      tallerVehicles: {
        trend: lastMonthTaller > 0 ? 'up' : 'stable',
        value: lastMonthTaller > 0 ? `+${lastMonthTaller} este mes` : 'Sin cambios',
      },
    };

    // Competiciones: organizador + progreso de tiempos (sin depender de columnas user_id/status)
    try {
      let summaries = options.competitionSummaries;
      if (!Array.isArray(summaries)) {
        summaries = await getCompetitionProgressSummariesCached(userId);
      }
      const incomplete = summaries.filter(
        (s) => s.participants_count > 0 && !s.is_completed,
      ).length;
      const newThisWeek = summaries.filter((s) => new Date(s.created_at) >= oneWeekAgo).length;

      trends.activeCompetitions = {
        trend: newThisWeek > 0 ? 'up' : 'stable',
        value:
          newThisWeek > 0
            ? `+${newThisWeek} esta semana`
            : incomplete > 0
              ? `${incomplete} con tiempos pendientes`
              : 'Al día',
      };
    } catch (error) {
      trends.activeCompetitions = {
        trend: 'stable',
        value: 'Sin datos',
      };
    }

    return trends;

  } catch (error) {
    console.error('Error calculando tendencias:', error);
    // Retornar tendencias por defecto en caso de error
    return {
      totalVehicles: { trend: 'stable', value: 'Sin datos' },
      modifiedVehicles: { trend: 'stable', value: 'Sin datos' },
      stockVehicles: { trend: 'stable', value: 'Sin datos' },
      totalInvestment: { trend: 'stable', value: 'Sin datos' },
      averagePriceIncrement: { trend: 'stable', value: 'Sin datos' },
      bestTime: { trend: 'stable', value: 'Sin datos' },
      lastUpdate: { trend: 'stable', value: 'Sistema activo' },
      activeCompetitions: { trend: 'stable', value: 'Sin datos' },
      digitalVehicles: { trend: 'stable', value: 'Sin datos' },
      museoVehicles: { trend: 'stable', value: 'Sin datos' },
      tallerVehicles: { trend: 'stable', value: 'Sin datos' },
    };
  }
};

router.get('/metrics', async (req, res) => {
  try {
    // Obtener total de vehículos y estadísticas básicas con todos los campos necesarios
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select(`
        id,
        type,
        model,
        manufacturer,
        price,
        total_price,
        modified,
        digital,
        museo,
        taller,
        purchase_date,
        technical_specs (
          id,
          is_modification,
          components (
            price,
            mounted_qty
          )
        ),
        vehicle_timings (
          best_lap_time,
          timing_date,
          circuit,
          laps,
          lane
        )
      `)
      .eq('user_id', req.user.id)
      .limit(500);

    if (vehiclesError) throw vehiclesError;

    // Calcular métricas básicas con redondeo
    const totalVehicles = vehicles.length;
    const modifiedVehicles = vehicles.filter(v => v.modified).length;
    const stockVehicles = totalVehicles - modifiedVehicles;
    const digitalVehicles = vehicles.filter((v) => v.digital).length;
    const museoVehicles = vehicles.filter((v) => v.museo).length;
    const tallerVehicles = vehicles.filter((v) => v.taller).length;
    
    // Calcular inversión total solo en modificaciones
    const totalInvestment = Number(vehicles
      .filter(v => v.modified && v.technical_specs?.length > 0)
      .reduce((sum, vehicle) => {
        // Sumar solo los componentes que son modificaciones
        const modificationCost = vehicle.technical_specs
          .filter(spec => spec.is_modification)
          .reduce((specSum, spec) => {
            const componentsCost = spec.components
              .reduce((compSum, comp) => compSum + modificationLineTotal(comp.price, comp.mounted_qty), 0);
            return specSum + componentsCost;
          }, 0);
        return sum + modificationCost;
      }, 0)
      .toFixed(2));
    
    const averageInvestmentPerVehicle = modifiedVehicles > 0 
      ? Number((totalInvestment / modifiedVehicles).toFixed(2))
      : 0;

    // Calcular incremento promedio y mayor incremento
    const vehiclesWithIncrement = vehicles
      .filter(v => v.modified && v.price > 0 && v.total_price > v.price)
      .map(v => ({
        ...v,
        price_increment: Number(((v.total_price - v.price) / v.price * 100).toFixed(2))
      }))
      .sort((a, b) => b.price_increment - a.price_increment);

    const averagePriceIncrement = vehiclesWithIncrement.length > 0
      ? Number((vehiclesWithIncrement.reduce((sum, v) => sum + v.price_increment, 0) / 
                vehiclesWithIncrement.length).toFixed(2))
      : 0;

    const highestIncrementVehicle = vehiclesWithIncrement[0] ? {
      id: vehiclesWithIncrement[0].id,
      model: vehiclesWithIncrement[0].model || 'Sin modelo',
      manufacturer: vehiclesWithIncrement[0].manufacturer || 'Sin marca',
      price: Number(vehiclesWithIncrement[0].price.toFixed(2)),
      total_price: Number(vehiclesWithIncrement[0].total_price.toFixed(2)),
      price_increment: vehiclesWithIncrement[0].price_increment,
      purchase_date: vehiclesWithIncrement[0].purchase_date
    } : null;

    // Obtener coche con mejor tiempo absoluto
    const { data: bestTimeVehicle, error: bestTimeError } = await supabase
      .from('vehicle_timings')
      .select(`
        best_lap_time,
        timing_date,
        circuit,
        laps,
        lane,
        vehicles!inner (
          id,
          model,
          manufacturer
        )
      `)
      .eq('vehicles.user_id', req.user.id)
      .not('best_lap_time', 'is', null)
      .gt('best_lap_time', 0)
      .order('best_lap_time', { ascending: true })
      .limit(1)
      .single();

    

    if (bestTimeError && bestTimeError.code !== 'PGRST116') {
      throw bestTimeError;
    }

    // Rendimiento por tipo: reutilizar vehículos ya cargados (evita segunda lectura sin límite)
    const typePerformance = computePerformanceByTypeFromVehicles(vehicles);

    // Calcular evolución del valor total de la colección por trimestres
    const getQuarterStartDate = (date) => {
      const d = new Date(date);
      const quarter = Math.floor(d.getMonth() / 3);
      return new Date(d.getFullYear(), quarter * 3, 1);
    };

    const getQuarterEndDate = (date) => {
      const d = new Date(date);
      const quarter = Math.floor(d.getMonth() / 3);
      return new Date(d.getFullYear(), (quarter + 1) * 3, 0);
    };

    // Ordenar vehículos por fecha de compra, usando la fecha actual para los que no tengan fecha
    const vehiclesByDate = vehicles
      .map(v => ({
        ...v,
        purchase_date: v.purchase_date || new Date().toISOString().split('T')[0]
      }))
      .sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));

    // Agrupar vehículos por trimestre
    const quarterlyData = vehiclesByDate.reduce((acc, vehicle) => {
      const purchaseDate = new Date(vehicle.purchase_date);
      const quarterStart = getQuarterStartDate(purchaseDate);
      const quarterKey = quarterStart.toISOString().split('T')[0];

      if (!acc[quarterKey]) {
        acc[quarterKey] = {
          date: quarterStart,
          endDate: getQuarterEndDate(purchaseDate),
          vehicles: [],
          totalValue: 0
        };
      }

      acc[quarterKey].vehicles.push(vehicle);
      acc[quarterKey].totalValue += Number(vehicle.total_price || vehicle.price || 0);

      return acc;
    }, {});

    // Convertir a array y calcular valores acumulados
    let accumulatedValue = 0;
    const investmentHistory = Object.values(quarterlyData)
      .sort((a, b) => a.date - b.date)
      .map(quarter => {
        accumulatedValue += quarter.totalValue ?? 0;
        return {
          date: quarter.date.toISOString().split('T')[0],
          endDate: quarter.endDate.toISOString().split('T')[0],
          value: Number((accumulatedValue ?? 0).toFixed(2)),
          vehicles: (quarter.vehicles || []).filter(v => v && typeof v.total_price === 'number').map(v => ({
            model: v.model || 'Sin modelo',
            manufacturer: v.manufacturer || 'Sin marca',
            price: v.total_price ? Number(v.total_price.toFixed(2)) : 0
          }))
        };
      });

    // Formatear fechas para la respuesta
    const formatDate = (dateString) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Asegurarnos de que el best_lap_time se formatea correctamente
    const bestTimeResponse = bestTimeVehicle ? {
      id: bestTimeVehicle.vehicles.id,
      model: bestTimeVehicle.vehicles.model || 'Sin modelo',
      manufacturer: bestTimeVehicle.vehicles.manufacturer || 'Sin marca',
      best_lap_time: bestTimeVehicle.best_lap_time, // Mantener el valor original
      timing_date: formatDate(bestTimeVehicle.timing_date),
      circuit: bestTimeVehicle.circuit || 'No especificado',
      laps: bestTimeVehicle.laps || 'No especificado',
      lane: bestTimeVehicle.lane || 'No especificado'
    } : null;

    let competitionSummaries = [];
    try {
      competitionSummaries = await getCompetitionProgressSummariesCached(req.user.id);
    } catch (e) {
      console.error('Métricas: resumen de competiciones:', e);
    }

    const vehiclesForTrends = vehicles.map((v) => ({
      id: v.id,
      model: v.model,
      manufacturer: v.manufacturer,
      price: v.price,
      total_price: v.total_price,
      modified: v.modified,
      digital: v.digital,
      museo: v.museo,
      taller: v.taller,
      purchase_date: v.purchase_date,
      created_at: v.created_at,
    }));

    const trends = await calculateTrends(req.user.id, { competitionSummaries, vehiclesForTrends });

    const activeCompetitionsCount = competitionSummaries.filter(
      (s) => s.participants_count > 0 && !s.is_completed,
    ).length;

    res.json({
      totalVehicles,
      modifiedVehicles,
      stockVehicles,
      digitalVehicles,
      museoVehicles,
      tallerVehicles,
      totalInvestment,
      averageInvestmentPerVehicle,
      averagePriceIncrement,
      lastUpdate: formatDate(new Date()),
      highestIncrementVehicle: highestIncrementVehicle ? {
        ...highestIncrementVehicle,
        purchase_date: formatDate(highestIncrementVehicle.purchase_date)
      } : null,
      bestTimeVehicle: bestTimeResponse,
      performanceByType: typePerformance,
      investmentHistory,
      trends,
      activeCompetitions: activeCompetitionsCount
    });
  } catch (error) {
    console.error('Error al obtener métricas del dashboard:', error);
    res.status(500).json({ error: 'Error al obtener métricas del dashboard' });
  }
});

// Nuevo endpoint para obtener datos de gráficos y tablas
router.get('/charts', async (req, res) => {
  try {
    // Una sola lectura de vehículos del usuario para gráficos/tablas de agregación
    const { data: vehiclesRows, error: vehiclesAggregateError } = await supabase
      .from('vehicles')
      .select('id, type, modified, manufacturer, purchase_place, model, price, total_price')
      .eq('user_id', req.user.id);

    if (vehiclesAggregateError) throw vehiclesAggregateError;

    const vehiclesByType = vehiclesRows || [];

    const typeStats = vehiclesByType.reduce((acc, vehicle) => {
      const t = vehicle.type || 'Sin tipo';
      if (!acc[t]) {
        acc[t] = {
          total: 0,
          modified: 0,
          stock: 0,
        };
      }
      acc[t].total++;
      if (vehicle.modified) {
        acc[t].modified++;
      } else {
        acc[t].stock++;
      }
      return acc;
    }, {});

    const totalVehicles = vehiclesByType.length;
    const totalModified = vehiclesByType.filter((v) => v.modified).length;
    const totalStock = totalVehicles - totalModified;

    // 3. Top 5 vehículos por mejor vuelta
    const { data: bestLaps, error: bestLapsError } = await supabase
      .from('vehicle_timings')
      .select(`
        best_lap_time,
        timing_date,
        circuit,
        vehicles (
          id,
          model,
          manufacturer
        )
      `)
      .eq('vehicles.user_id', req.user.id)
      .order('best_lap_time', { ascending: true })
      .limit(5);

    if (bestLapsError) throw bestLapsError;

    // Top 5 vehículos con mayor coste (misma lista `vehiclesByType`, sin query adicional)
    const topCostVehiclesProcessed = [...vehiclesByType]
      .filter((v) => Number(v.price) > 0)
      .sort((a, b) => Number(b.total_price || 0) - Number(a.total_price || 0))
      .slice(0, 5)
      .map((vehicle) => ({
        id: vehicle.id,
        model: vehicle.model,
        manufacturer: vehicle.manufacturer,
        basePrice: vehicle.price,
        totalPrice: vehicle.total_price,
        incrementPercentage: ((vehicle.total_price - vehicle.price) / vehicle.price) * 100,
      }));

    // 5. Componentes más utilizados en modificaciones
    const { data: componentsData, error: componentsError } = await supabase
      .from('technical_specs')
      .select(`
        id,
        is_modification,
        components!inner (
          id,
          element,
          sku,
          price,
          mounted_qty,
          component_type,
          url
        ),
        vehicles!inner (
          id,
          model,
          manufacturer
        )
      `)
      .eq('is_modification', true)
      .eq('vehicles.user_id', req.user.id);

    if (componentsError) throw componentsError;

    // Procesar datos de componentes agrupando por SKU y component_type
    const componentUsage = {};
    componentsData.forEach(spec => {
      const vehicleInfo = {
        id: spec.vehicles.id,
        model: spec.vehicles.model,
        manufacturer: spec.vehicles.manufacturer
      };

      spec.components.forEach(component => {
        // Usar combinación de SKU y component_type como clave
        const componentKey = component.sku 
          ? `${component.sku}-${component.component_type}`
          : `no-sku-${component.id}-${component.component_type}`;
        
        if (!componentUsage[componentKey]) {
          componentUsage[componentKey] = {
            id: component.id, // Mantener el ID del primer componente encontrado
            name: component.element,
            sku: component.sku,
            component_type: component.component_type,
            unitPrice: component.price,
            urls: new Set(), // Usar Set para evitar URLs duplicadas
            totalInvestment: 0,
            usageCount: 0,
            vehicles: []
          };
        }
        
        componentUsage[componentKey].usageCount++;
        componentUsage[componentKey].totalInvestment += modificationLineTotal(
          component.price,
          component.mounted_qty
        );
        
        // Añadir vehículo si no está ya en la lista
        if (!componentUsage[componentKey].vehicles.some(v => v.id === vehicleInfo.id)) {
          componentUsage[componentKey].vehicles.push(vehicleInfo);
        }

        // Añadir URL si existe y no está duplicada
        if (component.url) {
          componentUsage[componentKey].urls.add(component.url);
        }

        // Si encontramos un componente con la misma combinación SKU-tipo pero diferente nombre o precio,
        // actualizamos con la información más reciente
        if (component.element !== componentUsage[componentKey].name ||
            component.price !== componentUsage[componentKey].unitPrice) {
          componentUsage[componentKey].name = component.element;
          componentUsage[componentKey].unitPrice = component.price;
        }
      });
    });

    // Convertir Sets de URLs a arrays antes de enviar la respuesta
    const topComponents = Object.values(componentUsage)
      .map(component => ({
        ...component,
        urls: Array.from(component.urls)
      }))
      .sort((a, b) => b.totalInvestment - a.totalInvestment)
      .slice(0, 10); // Top 10 componentes

    const brandDistribution = vehiclesByType.reduce((acc, vehicle) => {
      const brand = vehicle.manufacturer || 'Sin marca';
      acc[brand] = (acc[brand] || 0) + 1;
      return acc;
    }, {});

    const storeDistribution = vehiclesByType.reduce((acc, vehicle) => {
      const store = vehicle.purchase_place || 'No especificada';
      acc[store] = (acc[store] || 0) + 1;
      return acc;
    }, {});

    res.json({
      vehiclesByType: Object.entries(typeStats).map(([type, stats]) => ({
        type,
        total: stats.total,
        modified: stats.modified,
        stock: stats.stock
      })),
      modificationStats: {
        total: totalVehicles,
        modified: totalModified,
        stock: totalStock,
        modifiedPercentage: totalVehicles > 0 ? (totalModified / totalVehicles) * 100 : 0,
      },
      bestLaps: bestLaps
        .filter(lap => lap.vehicles !== null) // Filtrar registros sin vehículo
        .map(lap => ({
          id: lap.vehicles.id,
          model: lap.vehicles.model || 'Sin modelo',
          manufacturer: lap.vehicles.manufacturer || 'Sin marca',
          bestTime: lap.best_lap_time,
          circuit: lap.circuit || 'No especificado',
          date: lap.timing_date
        })),
      topCostVehicles: topCostVehiclesProcessed,
      topComponents,
      brandDistribution: Object.entries(brandDistribution).map(([brand, count]) => ({
        name: brand,
        value: count
      })),
      storeDistribution: Object.entries(storeDistribution).map(([store, count]) => ({
        name: store,
        value: count
      }))
    });
  } catch (error) {
    console.error('Error al obtener datos de gráficos:', error);
    res.status(500).json({ error: 'Error al obtener datos de gráficos' });
  }
});

router.get('/action-items', async (req, res) => {
  try {
    const userId = req.user.id;
    const staleDaysThreshold = resolveStaleDaysThreshold(req.user);
    const generatedAt = new Date().toISOString();

    const competitionSummaries = await getCompetitionProgressSummariesCached(userId);

    const withParticipantsIncomplete = competitionSummaries.filter(
      (s) => s.participants_count > 0 && !s.is_completed,
    );

    const sortedByRecent = [...withParticipantsIncomplete].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
    const pickNext = sortedByRecent[0];
    const nextCompetition = pickNext
      ? {
          id: pickNext.id,
          name: pickNext.name,
          circuit_name: pickNext.circuit_name,
          times_remaining: pickNext.times_remaining,
          times_registered: pickNext.times_registered,
          total_required_times: pickNext.total_required_times,
          progress_percentage:
            pickNext.total_required_times > 0
              ? Math.round((pickNext.times_registered / pickNext.total_required_times) * 100)
              : 0,
        }
      : null;

    const openCompetitionTimings = [...withParticipantsIncomplete]
      .sort((a, b) => b.times_remaining - a.times_remaining)
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        name: s.name,
        circuit_name: s.circuit_name,
        times_remaining: s.times_remaining,
        times_registered: s.times_registered,
        total_required_times: s.total_required_times,
        progress_percentage:
          s.total_required_times > 0
            ? Math.round((s.times_registered / s.total_required_times) * 100)
            : 0,
      }));

    const { data: vehicles, error: vehErr } = await supabase
      .from('vehicles')
      .select('id, model, manufacturer')
      .eq('user_id', userId);

    if (vehErr) {
      console.error('action-items vehicles:', vehErr);
    }

    const vehicleIds = (vehicles || []).map((v) => v.id);
    let usualCircuit = null;
    let staleVehiclesAtUsualCircuit = [];

    if (vehicleIds.length > 0) {
      const { data: vtRows, error: vtErr } = await supabase
        .from('vehicle_timings')
        .select('vehicle_id, timing_date, circuit_id, circuit, circuits(id, name)')
        .in('vehicle_id', vehicleIds)
        .order('timing_date', { ascending: false })
        .limit(8000);

      if (vtErr) {
        console.error('action-items vehicle_timings:', vtErr);
      } else if (vtRows?.length) {
        const counts = new Map();
        for (const row of vtRows) {
          const k = circuitSessionKey(row);
          counts.set(k, (counts.get(k) || 0) + 1);
        }
        let maxKey = null;
        let maxCount = 0;
        for (const [k, c] of counts) {
          if (c > maxCount) {
            maxCount = c;
            maxKey = k;
          }
        }
        if (maxKey) {
          const label =
            circuitLabelFromKey(maxKey, vtRows) || (maxKey.startsWith('n:') ? maxKey.slice(2) : 'Circuito habitual');
          usualCircuit = {
            key: maxKey,
            name: label || 'Circuito habitual',
            session_count: maxCount,
          };

          const thresholdMs = Date.now() - staleDaysThreshold * 24 * 60 * 60 * 1000;
          const lastByVehicle = new Map();
          for (const row of vtRows) {
            if (circuitSessionKey(row) !== maxKey) continue;
            const vid = row.vehicle_id;
            const t = new Date(row.timing_date).getTime();
            if (Number.isNaN(t)) continue;
            if (!lastByVehicle.has(vid) || t > lastByVehicle.get(vid)) {
              lastByVehicle.set(vid, t);
            }
          }

          for (const v of vehicles || []) {
            if (!lastByVehicle.has(v.id)) continue;
            const last = lastByVehicle.get(v.id);
            if (last < thresholdMs) {
              staleVehiclesAtUsualCircuit.push({
                id: v.id,
                model: v.model,
                manufacturer: v.manufacturer,
                last_session_at: new Date(last).toISOString(),
                days_since: Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000)),
              });
            }
          }
          staleVehiclesAtUsualCircuit.sort((a, b) => b.days_since - a.days_since);
          staleVehiclesAtUsualCircuit = staleVehiclesAtUsualCircuit.slice(0, 5);
        }
      }
    }

    const { data: invRows, error: invErr } = await supabase
      .from('inventory_items')
      .select('id, name, reference, category, quantity, min_stock')
      .eq('user_id', userId);

    if (invErr) {
      console.error('action-items inventory:', invErr);
    }

    let lowStockCritical = [];
    if (!invErr && invRows?.length) {
      lowStockCritical = invRows
        .filter(
          (r) =>
            r.min_stock != null &&
            Number(r.quantity) <= Number(r.min_stock) &&
            CRITICAL_INVENTORY_CATEGORIES.has(String(r.category)),
        )
        .sort((a, b) => Number(a.quantity) - Number(b.quantity))
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          name: r.name,
          reference: r.reference,
          category: r.category,
          quantity: r.quantity,
          min_stock: r.min_stock,
        }));
    }

    res.json({
      generatedAt,
      staleDaysThreshold,
      nextCompetition,
      openCompetitionTimings,
      usualCircuit,
      staleVehiclesAtUsualCircuit,
      lowStockCritical,
    });
  } catch (error) {
    console.error('Error al obtener action-items del dashboard:', error);
    res.status(500).json({ error: 'Error al obtener datos accionables del dashboard' });
  }
});

/**
 * Últimos mantenimientos y vehículos sin revisión reciente (umbral = stale_days del perfil).
 */
router.get('/maintenance-summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const staleDays = resolveStaleDaysThreshold(req.user);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - staleDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data: recentRows, error: recentErr } = await supabase
      .from('vehicle_maintenance_log')
      .select(
        `
        id,
        performed_at,
        kind,
        vehicle_id,
        vehicles ( id, model, manufacturer )
      `,
      )
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(12);

    if (recentErr) throw recentErr;

    const recent = (recentRows || []).map((row) => ({
      id: row.id,
      performed_at: row.performed_at,
      kind: row.kind,
      vehicle_id: row.vehicle_id,
      model: row.vehicles?.model,
      manufacturer: row.vehicles?.manufacturer,
    }));

    const { data: allVehicles, error: vErr } = await supabase
      .from('vehicles')
      .select('id, model, manufacturer')
      .eq('user_id', userId)
      .limit(500);

    if (vErr) throw vErr;

    const { data: allLogs, error: lErr } = await supabase
      .from('vehicle_maintenance_log')
      .select('vehicle_id, performed_at')
      .eq('user_id', userId)
      .order('performed_at', { ascending: false })
      .limit(800);

    if (lErr) throw lErr;

    const lastByVehicle = new Map();
    for (const log of allLogs || []) {
      const vid = log.vehicle_id;
      const d = log.performed_at;
      const prev = lastByVehicle.get(vid);
      if (!prev || String(d) > String(prev)) lastByVehicle.set(vid, d);
    }

    const staleList = [];
    for (const v of allVehicles || []) {
      const last = lastByVehicle.get(v.id);
      if (last == null || String(last) < cutoffStr) {
        staleList.push({
          id: v.id,
          model: v.model,
          manufacturer: v.manufacturer,
          last_maintenance_at: last || null,
        });
      }
    }

    /** Próximo mantenimiento: el registro más reciente por vehículo (performed_at); si su next_due_at está entre hoy y hoy+7 días. */
    let upcomingScheduled = [];
    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      const endStr = end.toISOString().slice(0, 10);

      const { data: allDueLogs, error: dueErr } = await supabase
        .from('vehicle_maintenance_log')
        .select(
          `
          id,
          vehicle_id,
          performed_at,
          kind,
          next_due_at,
          vehicles ( id, model, manufacturer )
        `,
        )
        .eq('user_id', userId)
        .order('performed_at', { ascending: false })
        .limit(1200);

      if (dueErr) throw dueErr;

      const latestByVehicle = new Map();
      for (const row of allDueLogs || []) {
        const vid = row.vehicle_id;
        if (!vid || latestByVehicle.has(vid)) continue;
        latestByVehicle.set(vid, row);
      }

      const upcoming = [];
      for (const row of latestByVehicle.values()) {
        const due = row.next_due_at != null ? String(row.next_due_at).slice(0, 10) : null;
        if (!due || due < todayStr || due > endStr) continue;
        upcoming.push({
          id: row.id,
          vehicle_id: row.vehicle_id,
          next_due_at: due,
          kind: row.kind,
          model: row.vehicles?.model,
          manufacturer: row.vehicles?.manufacturer,
        });
      }
      upcoming.sort((a, b) => String(a.next_due_at).localeCompare(String(b.next_due_at)));
      upcomingScheduled = upcoming;
    } catch (dueE) {
      console.error('maintenance-summary upcomingScheduled:', dueE);
      upcomingScheduled = [];
    }

    res.json({
      recent,
      vehiclesWithoutRecentMaintenance: staleList.slice(0, 50),
      vehiclesWithoutRecentMaintenanceTotal: staleList.length,
      staleDaysThreshold: staleDays,
      upcomingScheduled,
    });
  } catch (e) {
    console.error('maintenance-summary:', e);
    res.status(500).json({ error: 'Error al obtener resumen de mantenimiento' });
  }
});

/**
 * GET /api/dashboard/training-goals-summary
 * Metas activas con progreso para el widget del dashboard.
 */
router.get('/training-goals-summary', async (req, res) => {
  try {
    const { data: goals, error } = await supabase
      .from('training_goals')
      .select('*, vehicles(id, model, manufacturer), circuits(name)')
      .eq('user_id', req.user.id)
      .eq('active', true)
      .is('achieved_at', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ error: error.message });

    const vehicleIds = [...new Set((goals || []).map((g) => g.vehicle_id))];
    let timingsByVehicle = {};
    if (vehicleIds.length > 0) {
      const { data: timings } = await supabase
        .from('vehicle_timings')
        .select('id, vehicle_id, circuit_id, lane, best_lap_time, best_lap_timestamp, consistency_score, timing_date')
        .in('vehicle_id', vehicleIds)
        .order('timing_date', { ascending: false })
        .limit(500);
      for (const t of timings || []) {
        if (!timingsByVehicle[t.vehicle_id]) timingsByVehicle[t.vehicle_id] = [];
        timingsByVehicle[t.vehicle_id].push(t);
      }
    }

    const summary = (goals || []).map((g) => {
      const progress = evaluateGoalProgress(g, timingsByVehicle[g.vehicle_id] || []);
      return {
        id: g.id,
        goal_type: g.goal_type,
        target_value: Number(g.target_value),
        lane: g.lane,
        circuit_name: g.circuits?.name,
        vehicle: g.vehicles,
        progress_pct: progress.progressPct,
        current_value: progress.currentValue,
        current_display:
          g.goal_type === 'lap_time' && progress.currentValue != null
            ? formatSecondsToLapTime(progress.currentValue)
            : progress.currentValue,
        target_display:
          g.goal_type === 'lap_time'
            ? formatSecondsToLapTime(Number(g.target_value))
            : `${Number(g.target_value).toFixed(1)}%`,
      };
    });

    res.json({ goals: summary });
  } catch (e) {
    console.error('training-goals-summary:', e);
    res.status(500).json({ error: 'Error al obtener metas de entrenamiento' });
  }
});

module.exports = router; 