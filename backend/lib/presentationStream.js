'use strict';

const { getServiceClient } = require('./supabaseClients');
const { normalizeStatus } = require('./competitionLifecycle');

const HEARTBEAT_MS = 30000;

/** @type {Map<string, { channel: import('@supabase/supabase-js').RealtimeChannel, refCount: number, listeners: Set<(payload: object) => void> }>} */
const slugHubs = new Map();

function isDraftCompetitionPublic(competition) {
  return normalizeStatus(competition) === 'draft';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} slug
 */
async function resolvePresentationContext(supabase, slug) {
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('id, name, status, public_slug')
    .eq('public_slug', slug)
    .single();

  if (compError || !competition) {
    return { ok: false, status: 404, error: 'Competición no encontrada' };
  }

  if (isDraftCompetitionPublic(competition)) {
    return { ok: false, status: 404, error: 'Competición no encontrada' };
  }

  const { data: participants, error: partError } = await supabase
    .from('competition_participants')
    .select('id')
    .eq('competition_id', competition.id);

  if (partError) {
    return { ok: false, status: 500, error: 'Error interno del servidor' };
  }

  const participantIds = (participants || []).map((p) => p.id).filter(Boolean);
  if (participantIds.length === 0) {
    return {
      ok: true,
      competitionId: competition.id,
      participantIds: [],
    };
  }

  return {
    ok: true,
    competitionId: competition.id,
    participantIds,
  };
}

/**
 * @param {string} slug
 * @param {string[]} participantIds
 * @param {(payload: object) => void} listener
 */
function subscribePresentationChanges(slug, participantIds, listener) {
  const supabase = getServiceClient();
  if (!supabase) {
    console.error('[presentationStream] SUPABASE_SERVICE_ROLE_KEY no configurada');
    return () => {};
  }

  let hub = slugHubs.get(slug);

  if (!hub) {
    const filter =
      participantIds.length > 0
        ? `participant_id=in.(${participantIds.join(',')})`
        : undefined;

    const channel = supabase
      .channel(`presentation:${slug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'competition_timings',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const current = slugHubs.get(slug);
          if (!current) return;
          current.listeners.forEach((fn) => {
            try {
              fn(payload);
            } catch (e) {
              console.error('[presentationStream] listener error', e);
            }
          });
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[presentationStream] channel error for slug', slug);
        }
      });

    hub = { channel, refCount: 0, listeners: new Set() };
    slugHubs.set(slug, hub);
  }

  hub.refCount += 1;
  hub.listeners.add(listener);

  return () => {
    const current = slugHubs.get(slug);
    if (!current) return;
    current.listeners.delete(listener);
    current.refCount -= 1;
    if (current.refCount <= 0 && current.listeners.size === 0) {
      supabase.removeChannel(current.channel);
      slugHubs.delete(slug);
    }
  };
}

/**
 * Configura SSE para modo presentación en vivo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} slug
 */
async function handlePresentationStream(req, res, slug) {
  const supabase = getServiceClient() || require('./supabaseClients').getServiceOrAnonClient();
  const ctx = await resolvePresentationContext(supabase, slug);

  if (!ctx.ok) {
    return res.status(ctx.status).json({ error: ctx.error });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: 'connected' });

  const heartbeat = setInterval(() => {
    sendEvent({ type: 'heartbeat', at: new Date().toISOString() });
  }, HEARTBEAT_MS);

  const unsubscribe = subscribePresentationChanges(slug, ctx.participantIds, () => {
    sendEvent({ type: 'refresh' });
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}

module.exports = {
  resolvePresentationContext,
  subscribePresentationChanges,
  handlePresentationStream,
  isDraftCompetitionPublic,
};
