'use strict';

/** Estados internos de competición (columna `competitions.status`). */
const STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  RUNNING: 'running',
  CLOSED: 'closed',
};

/** Normaliza fila antigua sin columna o valor null. */
function normalizeStatus(competition) {
  const s = competition?.status;
  if (!s || typeof s !== 'string') return STATUS.PUBLISHED;
  return s;
}

function timingForbiddenReason(status) {
  const s = normalizeStatus({ status });
  if (s === STATUS.CLOSED) return 'La competición está cerrada; no se pueden registrar tiempos.';
  return null;
}

function participantMutationForbiddenReason(status) {
  const s = normalizeStatus({ status });
  if (s === STATUS.CLOSED || s === STATUS.RUNNING) {
    return 'No se pueden añadir ni eliminar participantes en este estado de la competición.';
  }
  return null;
}

function metadataEditForbiddenReason(status) {
  const s = normalizeStatus({ status });
  if (s === STATUS.CLOSED || s === STATUS.RUNNING) {
    return 'No se puede editar la configuración de la competición en este estado.';
  }
  return null;
}

function signupForbiddenReason(status) {
  const s = normalizeStatus({ status });
  if (s !== STATUS.PUBLISHED) {
    return 'Las inscripciones solo están abiertas cuando la competición está publicada.';
  }
  return null;
}

function registrationDeadlineExpired(competition) {
  const deadline = competition?.registration_deadline;
  if (!deadline) return false;
  return new Date() > new Date(deadline);
}

function registrationDeadlineForbiddenReason(competition) {
  if (registrationDeadlineExpired(competition)) {
    return 'El plazo de inscripción ha finalizado.';
  }
  return null;
}

/**
 * Transiciones manuales permitidas para PATCH status.
 * @returns {string|null} error message or null
 */
/**
 * Cuenta tiempos registrados en una competición.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 */
async function countCompetitionTimings(supabase, competitionId) {
  const { data: participants, error: partErr } = await supabase
    .from('competition_participants')
    .select('id')
    .eq('competition_id', competitionId);

  if (partErr) {
    throw new Error(partErr.message);
  }

  const participantIds = (participants || []).map((p) => p.id);
  if (participantIds.length === 0) {
    return 0;
  }

  const { count, error: countErr } = await supabase
    .from('competition_timings')
    .select('*', { count: 'exact', head: true })
    .in('participant_id', participantIds);

  if (countErr) {
    throw new Error(countErr.message);
  }

  return count || 0;
}

/**
 * Pasa la competición a `running` cuando se registra el primer tiempo y aún está publicada.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} competitionId
 * @param {string|null|undefined} currentStatus
 * @param {number} [timingsBefore]
 */
async function promoteCompetitionToRunningOnFirstTiming(
  supabase,
  competitionId,
  currentStatus,
  timingsBefore = 0,
) {
  if (normalizeStatus({ status: currentStatus }) !== STATUS.PUBLISHED) {
    return { promoted: false };
  }
  if (timingsBefore > 0) {
    return { promoted: false };
  }

  const { data, error } = await supabase
    .from('competitions')
    .update({ status: STATUS.RUNNING })
    .eq('id', competitionId)
    .eq('status', STATUS.PUBLISHED)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[competitionLifecycle] No se pudo pasar la competición a running:', error.message);
    return { promoted: false, error: error.message };
  }

  return { promoted: Boolean(data?.id) };
}

function validateManualStatusTransition(fromRaw, toRaw, opts = {}) {
  const from = normalizeStatus({ status: fromRaw });
  const to = normalizeStatus({ status: toRaw });
  const participantsCount = opts.participantsCount ?? 0;

  if (from === to) return null;

  if (from === STATUS.DRAFT && to === STATUS.PUBLISHED) return null;

  if (from === STATUS.PUBLISHED && to === STATUS.DRAFT) {
    if (participantsCount > 0) {
      return 'No se puede despublicar: ya hay participantes confirmados.';
    }
    return null;
  }

  if (from === STATUS.RUNNING && to === STATUS.CLOSED) return null;

  if (from === STATUS.CLOSED && to === STATUS.PUBLISHED) return null;

  return `Transición no permitida: ${from} → ${to}`;
}

module.exports = {
  STATUS,
  normalizeStatus,
  timingForbiddenReason,
  participantMutationForbiddenReason,
  metadataEditForbiddenReason,
  signupForbiddenReason,
  registrationDeadlineExpired,
  registrationDeadlineForbiddenReason,
  countCompetitionTimings,
  promoteCompetitionToRunningOnFirstTiming,
  validateManualStatusTransition,
};
