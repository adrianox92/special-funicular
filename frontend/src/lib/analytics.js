import { track } from '@vercel/analytics';

/** Event names from the session-mode PRD. Keep these exact snake_case strings. */
export const SESSION_EVENTS = {
  MODE_OPENED: 'session_mode_opened',
  CIRCUIT_SELECTED: 'session_circuit_selected',
  CIRCUIT_CREATED: 'session_circuit_created',
  VEHICLE_SELECTED: 'session_vehicle_selected',
  TIMING_SAVED: 'session_timing_saved',
  ABANDONED: 'session_abandoned',
};

const ALLOWED_FUNNEL_KEYS = {
  step: 'step',
  hasPriorCircuit: 'has_prior_circuit',
  circuitCreated: 'circuit_created',
  laneSet: 'lane_set',
  voltageSet: 'voltage_set',
};

/**
 * Whitelist of PII-free funnel properties. Unknown keys (vehicle names, emails,
 * raw times) are dropped so callers cannot leak them by accident.
 *
 * @param {object} [funnel]
 * @returns {Record<string, string|boolean>|undefined}
 */
export function buildSessionFunnelProps(funnel = {}) {
  if (!funnel || typeof funnel !== 'object') return undefined;
  const props = {};
  if (funnel.step != null && funnel.step !== '') {
    props[ALLOWED_FUNNEL_KEYS.step] = String(funnel.step);
  }
  if (typeof funnel.hasPriorCircuit === 'boolean') {
    props[ALLOWED_FUNNEL_KEYS.hasPriorCircuit] = funnel.hasPriorCircuit;
  }
  if (typeof funnel.circuitCreated === 'boolean') {
    props[ALLOWED_FUNNEL_KEYS.circuitCreated] = funnel.circuitCreated;
  }
  if (typeof funnel.laneSet === 'boolean') {
    props[ALLOWED_FUNNEL_KEYS.laneSet] = funnel.laneSet;
  }
  if (typeof funnel.voltageSet === 'boolean') {
    props[ALLOWED_FUNNEL_KEYS.voltageSet] = funnel.voltageSet;
  }
  return Object.keys(props).length ? props : undefined;
}

function isAllowedPropertyValue(value) {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function sanitizeProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return undefined;
  }
  const out = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined) continue;
    if (isAllowedPropertyValue(value)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Thin wrapper around Vercel Analytics `track`. Never throws — no-ops when the
 * script is missing, `track` is unavailable, or the call fails (tests / adblock).
 *
 * @param {string} name
 * @param {Record<string, string|number|boolean|null>} [properties]
 */
export function trackEvent(name, properties) {
  if (!name || typeof name !== 'string') return;
  try {
    if (typeof track !== 'function') return;
    const props = sanitizeProperties(properties);
    if (props) {
      track(name, props);
    } else {
      track(name);
    }
  } catch {
    /* analytics must never break the product flow */
  }
}

export function trackSessionEvent(name, funnel) {
  trackEvent(name, buildSessionFunnelProps(funnel));
}
