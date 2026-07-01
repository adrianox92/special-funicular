'use strict';

/** Stable API error codes for frontend i18n. */
const API_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CIRCUIT_NOT_FOUND: 'CIRCUIT_NOT_FOUND',
  CLUB_NOT_MEMBER: 'CLUB_NOT_MEMBER',
  CLUB_NOT_ADMIN: 'CLUB_NOT_ADMIN',
  VEHICLE_NOT_FOUND: 'VEHICLE_NOT_FOUND',
  COMPETITION_NOT_FOUND: 'COMPETITION_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} [message] Fallback Spanish message for logs/clients without i18n
 */
function sendApiError(res, status, code, message) {
  res.status(status).json({
    error: message || code,
    code,
  });
}

module.exports = {
  API_ERROR_CODES,
  sendApiError,
};
