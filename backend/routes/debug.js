/**
 * Rutas de diagnóstico (sin secretos). Sirven para contrastar producción vs local:
 * URL de API, entorno del servidor y conteos Supabase con el mismo cliente anon
 * que usan vehicles/inventory/timings frente al cliente con JWT del usuario.
 */
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getAnonClient, createUserScopedClient, getServiceClient } = require('../lib/supabaseClients');

const router = express.Router();
const supabaseAnon = getAnonClient();

function safeSupabaseHost() {
  const raw = process.env.SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function wrapPgError(err) {
  if (!err) return null;
  return {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  };
}

async function headCountForUser(client, table, userId) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) {
    return { count: null, error: wrapPgError(error) };
  }
  return { count: count ?? 0, error: null };
}

async function vehicleIdsForUser(client, userId) {
  const { data, error } = await client.from('vehicles').select('id').eq('user_id', userId);
  if (error) {
    return { ids: null, error: wrapPgError(error) };
  }
  const ids = (data || []).map((r) => r.id).filter(Boolean);
  return { ids, error: null };
}

async function timingsCountForUser(client, userId) {
  const { ids, error: vidErr } = await vehicleIdsForUser(client, userId);
  if (vidErr) {
    return { count: null, error: vidErr, vehicleRowCount: null };
  }
  if (!ids.length) {
    return { count: 0, error: null, vehicleRowCount: 0 };
  }
  const { count, error } = await client
    .from('vehicle_timings')
    .select('*', { count: 'exact', head: true })
    .in('vehicle_id', ids);
  if (error) {
    return { count: null, error: wrapPgError(error), vehicleRowCount: ids.length };
  }
  return { count: count ?? 0, error: null, vehicleRowCount: ids.length };
}

/** Público: comprobar que llegas al backend y cómo está configurado (sin claves). */
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || null,
    supabaseHost: safeSupabaseHost(),
    env: {
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.SUPABASE_KEY),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
});

/**
 * Autenticado: misma lógica de acceso que las rutas reales (anon singleton vs JWT).
 * Si `anon` da 0 y `userJwt` da > 0, las políticas RLS necesitan JWT en PostgREST
 * (o el backend debe usar service role / createUserScopedClient por request).
 */
router.get('/data-path', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const userClient = createUserScopedClient(req.headers.authorization);

  try {
    const vehiclesAnon = await headCountForUser(supabaseAnon, 'vehicles', userId);
    const vehiclesUserJwt = await headCountForUser(userClient, 'vehicles', userId);

    const inventoryAnon = await headCountForUser(supabaseAnon, 'inventory_items', userId);
    const inventoryUserJwt = await headCountForUser(userClient, 'inventory_items', userId);

    const timingsAnon = await timingsCountForUser(supabaseAnon, userId);
    const timingsUserJwt = await timingsCountForUser(userClient, userId);

    const service = getServiceClient();
    let vehiclesServiceRole = null;
    if (service) {
      vehiclesServiceRole = await headCountForUser(service, 'vehicles', userId);
    }

    const hints = [];
    if (vehiclesAnon.count === 0 && vehiclesUserJwt.count > 0) {
      hints.push(
        'vehicles: conteo con cliente anon es 0 pero con JWT de usuario hay filas — RLS u omisión del JWT en el cliente del servidor.',
      );
    }
    if (
      vehiclesServiceRole &&
      vehiclesServiceRole.count > 0 &&
      vehiclesAnon.count === 0 &&
      vehiclesUserJwt.count === 0
    ) {
      hints.push(
        'vehicles: service role ve datos pero anon y JWT no — revisa políticas RLS y que el JWT sea del mismo proyecto Supabase.',
      );
    }
    if (vehiclesAnon.count > 0 && timingsAnon.count === 0 && timingsUserJwt.count === 0) {
      hints.push(
        'timings: hay vehículos pero 0 tiempos con ambos clientes — coherente con BBDD vacía de tiempos o filtros; si en local hay tiempos, revisa si es el mismo proyecto Supabase.',
      );
    }

    res.json({
      ok: true,
      userId,
      supabaseHost: safeSupabaseHost(),
      counts: {
        vehicles: { anon: vehiclesAnon, userJwt: vehiclesUserJwt, serviceRole: vehiclesServiceRole },
        inventory_items: { anon: inventoryAnon, userJwt: inventoryUserJwt },
        vehicle_timings: { anon: timingsAnon, userJwt: timingsUserJwt },
      },
      hints,
    });
  } catch (e) {
    console.error('[debug/data-path]', e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

module.exports = router;
