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

/**
 * Transiciones manuales permitidas para PATCH status.
 * @returns {string|null} error message or null
 */
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
  validateManualStatusTransition,
};
