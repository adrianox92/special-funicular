'use strict';

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getServiceClient } = require('../lib/supabaseClients');

const SOURCES = new Set(['signup', 'profile', 'unsubscribe']);

function mapRow(row) {
  if (!row) {
    return {
      consented: false,
      given_at: null,
      withdrawn_at: null,
      source: null,
      updated_at: null,
    };
  }
  return {
    consented: Boolean(row.consented),
    given_at: row.given_at ?? null,
    withdrawn_at: row.withdrawn_at ?? null,
    source: row.source ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function parseSource(raw, fallback) {
  const s = String(raw || '').trim().toLowerCase();
  return SOURCES.has(s) ? s : fallback;
}

function serviceOrFail(res) {
  const sb = getServiceClient();
  if (!sb) {
    res.status(500).json({ error: 'Servicio no configurado' });
    return null;
  }
  return sb;
}

async function upsertConsent(sb, userId, consented, source) {
  const now = new Date().toISOString();
  const { data: existing, error: readErr } = await sb
    .from('user_marketing_consents')
    .select('user_id, consented, given_at, withdrawn_at, source, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) throw readErr;

  const payload = {
    user_id: userId,
    consented: Boolean(consented),
    source,
    updated_at: now,
  };
  if (payload.consented) {
    payload.given_at = now;
    payload.withdrawn_at = existing?.withdrawn_at ?? null;
  } else if (existing?.consented) {
    payload.withdrawn_at = now;
    payload.given_at = existing.given_at ?? null;
  } else {
    payload.given_at = existing?.given_at ?? null;
    payload.withdrawn_at = existing?.withdrawn_at ?? null;
  }

  const { data, error } = await sb
    .from('user_marketing_consents')
    .upsert(payload, { onConflict: 'user_id' })
    .select('consented, given_at, withdrawn_at, source, updated_at')
    .single();
  if (error) throw error;
  return data;
}

const authed = express.Router();
authed.use(authMiddleware);

authed.get('/', async (req, res) => {
  try {
    const sb = serviceOrFail(res);
    if (!sb) return;
    const { data, error } = await sb
      .from('user_marketing_consents')
      .select('consented, given_at, withdrawn_at, source, updated_at')
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(mapRow(data));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
});

authed.put('/', async (req, res) => {
  try {
    const sb = serviceOrFail(res);
    if (!sb) return;
    if (typeof req.body?.consented !== 'boolean') {
      return res.status(400).json({ error: 'consented debe ser boolean' });
    }
    const source = parseSource(req.body?.source, 'profile');
    const data = await upsertConsent(sb, req.user.id, req.body.consented, source);
    return res.json(mapRow(data));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
});

const publicRouter = express.Router();

publicRouter.get('/unsubscribe', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(token)) {
      return res.status(400).json({ error: 'token no válido' });
    }
    const sb = serviceOrFail(res);
    if (!sb) return;
    const { data: row, error: readErr } = await sb
      .from('user_marketing_consents')
      .select('user_id, consented, given_at, withdrawn_at, source, updated_at')
      .eq('unsubscribe_token', token)
      .maybeSingle();
    if (readErr) return res.status(500).json({ error: readErr.message });
    if (!row) return res.status(404).json({ error: 'token no válido' });
    if (!row.consented) return res.json(mapRow(row));
    const data = await upsertConsent(sb, row.user_id, false, 'unsubscribe');
    return res.json(mapRow(data));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
});

module.exports = { marketingConsentRoute: authed, marketingUnsubscribeRoute: publicRouter };
