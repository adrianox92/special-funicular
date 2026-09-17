'use strict';

const { getServiceClient } = require('./supabaseClients');

const DEFAULT_TO = 'adrianpalomera17@gmail.com';
const DEFAULT_LIMIT = 40;
const MADRID_TZ = 'Europe/Madrid';
/** JS getDay(): 0 domingo … 6 sábado. Informe: lunes y jueves. */
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const CATALOG_GAP_WEEKDAYS = new Set([1, 4]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getFromAddress() {
  return (
    process.env.RESEND_FROM ||
    process.env.CONTACT_FROM ||
    'Slot Database <onboarding@resend.dev>'
  );
}

function getReportRecipients() {
  const raw = process.env.CATALOG_GAP_REPORT_TO || DEFAULT_TO;
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getReportLimit() {
  const raw = Number.parseInt(String(process.env.CATALOG_GAP_REPORT_LIMIT || DEFAULT_LIMIT), 10);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(100, Math.max(1, raw));
}

/** Hora 0–23 en Europe/Madrid. */
function hourInMadrid(now = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TZ,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(now);
  return Number.parseInt(formatted, 10);
}

/** Día de la semana 0–6 (domingo–sábado) en Europe/Madrid, no UTC. */
function weekdayInMadrid(now = new Date()) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID_TZ,
    weekday: 'short',
  }).format(now);
  const idx = WEEKDAY_INDEX[formatted];
  return Number.isInteger(idx) ? idx : -1;
}

function isCatalogGapWeekday(now = new Date()) {
  return CATALOG_GAP_WEEKDAYS.has(weekdayInMadrid(now));
}

function madridDateIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function formatMadridDateLong(now = new Date()) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: MADRID_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
}

function formatPct(part, total) {
  if (!total) return '0,0%';
  const pct = (Number(part) / Number(total)) * 100;
  return `${pct.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function adminDashboardUrl() {
  const base = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  return base ? `${base}/admin/dashboard` : null;
}

function rowCount(row) {
  const n = row.linkable_vehicle_count ?? row.vehicle_count ?? 0;
  return Number(n) || 0;
}

async function countVehicles(admin, { linkedOnly = false } = {}) {
  let query = admin.from('vehicles').select('id', { count: 'exact', head: true });
  if (linkedOnly) {
    query = query.not('catalog_item_id', 'is', null);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(error.message || 'Error al contar vehículos');
  }
  return Number(count) || 0;
}

async function fetchMissingRefs(admin, limit) {
  const { data, error } = await admin.rpc('admin_vehicle_refs_missing_catalog', {
    p_limit: limit,
    p_offset: 0,
    p_only_unlinked: true,
  });
  if (error) {
    throw new Error(error.message || 'Error al calcular referencias sin catálogo');
  }
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return {
    total: typeof payload.total === 'number' ? payload.total : 0,
    rows: Array.isArray(payload.rows) ? payload.rows : [],
  };
}

function buildEmail({ coverage, missing, now }) {
  const dashboardUrl = adminDashboardUrl();
  const dateLabel = formatMadridDateLong(now);
  const pct = formatPct(coverage.linked, coverage.total);
  const unlinked = Math.max(0, coverage.total - coverage.linked);
  const subject = `Catálogo: referencias sin ficha — cobertura ${pct} — ${dateLabel}`;

  const textLines = [
    `Informe de huecos de catálogo (lunes y jueves, ${dateLabel}).`,
    '',
    `Vehículos totales: ${coverage.total}`,
    `Con catálogo asociado: ${coverage.linked} (${pct})`,
    `Sin catálogo asociado: ${unlinked}`,
    `Referencias distintas que no existen en el catálogo (con vehículos sin asignar): ${missing.total}`,
    '',
    'Top referencias ausentes del catálogo (más vehículos sin asignar):',
  ];

  missing.rows.forEach((row, i) => {
    const ref = row.reference || '—';
    const mfg = row.sample_manufacturer || '—';
    const model = row.sample_model || '—';
    const vehicles = rowCount(row);
    const users = row.linkable_distinct_user_count ?? row.distinct_user_count ?? 0;
    textLines.push(
      `${i + 1}. ${ref} · ${mfg} ${model} · ${vehicles} vehículos · ${users} usuarios`,
    );
  });

  if (missing.rows.length === 0) {
    textLines.push('(ninguna en este recorte)');
  }
  if (dashboardUrl) {
    textLines.push('', `Admin: ${dashboardUrl}`);
  }
  textLines.push('', 'Slot Database');

  const tableRows = missing.rows
    .map((row) => {
      const ref = escapeHtml(row.reference || '—');
      const mfg = escapeHtml(row.sample_manufacturer || '—');
      const model = escapeHtml(row.sample_model || '—');
      const vehicles = escapeHtml(String(rowCount(row)));
      const users = escapeHtml(String(row.linkable_distinct_user_count ?? row.distinct_user_count ?? 0));
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e5e5;font-family:ui-monospace,monospace;">${ref}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e5e5;">${mfg}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e5e5;">${model}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e5e5;text-align:right;">${vehicles}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e5e5;text-align:right;">${users}</td>
      </tr>`;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es" dir="ltr">
<head><title>${escapeHtml(subject)}</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;font-size:16px;">
  <div lang="es" dir="ltr">
    <h1 style="font-size:20px;">Huecos de catálogo</h1>
    <p>Referencias de garaje que <strong>no existen</strong> en el catálogo, ordenadas por vehículos creados <strong>sin</strong> <code>catalog_item_id</code>.</p>
    <p style="color:#555;">${escapeHtml(dateLabel)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:12px 0 20px;">
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Vehículos totales</td><td><strong>${escapeHtml(String(coverage.total))}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Con catálogo asociado</td><td><strong>${escapeHtml(String(coverage.linked))}</strong> (${escapeHtml(pct)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Sin catálogo asociado</td><td><strong>${escapeHtml(String(unlinked))}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Refs distintas ausentes</td><td><strong>${escapeHtml(String(missing.total))}</strong></td></tr>
    </table>
    <h2 style="font-size:16px;">Top ${escapeHtml(String(missing.rows.length))} por vehículos sin asignar</h2>
    ${
      missing.rows.length
        ? `<table role="table" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:720px;">
      <thead>
        <tr>
          <th align="left" style="padding:8px 10px;border-bottom:2px solid #111;font-size:13px;">Referencia</th>
          <th align="left" style="padding:8px 10px;border-bottom:2px solid #111;font-size:13px;">Marca</th>
          <th align="left" style="padding:8px 10px;border-bottom:2px solid #111;font-size:13px;">Modelo</th>
          <th align="right" style="padding:8px 10px;border-bottom:2px solid #111;font-size:13px;">Vehículos</th>
          <th align="right" style="padding:8px 10px;border-bottom:2px solid #111;font-size:13px;">Usuarios</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>`
        : '<p>No hay referencias pendientes en este recorte.</p>'
    }
    ${dashboardUrl ? `<p><a href="${escapeHtml(dashboardUrl)}">Abrir dashboard de plataforma</a></p>` : ''}
    <p style="color:#666;font-size:13px;">Slot Database · informe automático lunes y jueves (9:00 Europe/Madrid)</p>
  </div>
</body>
</html>`;

  return { subject, html, text: textLines.join('\n') };
}

async function sendCatalogGapEmail({ coverage, missing, now, force = false }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[catalog-gap] RESEND_API_KEY no configurado; no se envía el informe');
    return { ok: false, skipped: true, reason: 'no_resend_key' };
  }

  const recipients = getReportRecipients();
  if (recipients.length === 0) {
    console.warn('[catalog-gap] CATALOG_GAP_REPORT_TO vacío; no se envía el informe');
    return { ok: false, skipped: true, reason: 'no_recipients' };
  }

  const { subject, html, text } = buildEmail({ coverage, missing, now });
  const day = madridDateIso(now);
  const idempotencyKey = force
    ? `catalog-gap-report/${day}/force-${Date.now()}`
    : `catalog-gap-report/${day}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: recipients,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[catalog-gap] Resend error:', res.status, txt);
    return { ok: false, reason: 'resend_error', status: res.status };
  }
  return { ok: true, to: recipients, subject };
}

/**
 * Genera y envía el informe. Pensado para Render Cron `0 7,8 * * 1,4`
 * (07:00 y 08:00 UTC, lunes y jueves). Solo envía cuando en Europe/Madrid
 * son las 9:00 de un lunes o jueves (salvo force). El día se evalúa en
 * Madrid para ser DST-safe (no se usa el weekday UTC).
 */
async function runCatalogGapReport({ force = false, now = new Date(), admin } = {}) {
  if (!force && hourInMadrid(now) !== 9) {
    return { skipped: true, reason: 'not_nine_am_madrid', madridHour: hourInMadrid(now) };
  }
  if (!force && !isCatalogGapWeekday(now)) {
    return {
      skipped: true,
      reason: 'not_monday_or_thursday_madrid',
      madridWeekday: weekdayInMadrid(now),
    };
  }

  const client = admin || getServiceClient();
  if (!client) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no disponible');
  }

  const limit = getReportLimit();
  const [total, linked, missing] = await Promise.all([
    countVehicles(client, { linkedOnly: false }),
    countVehicles(client, { linkedOnly: true }),
    fetchMissingRefs(client, limit),
  ]);

  const coverage = { total, linked };
  const sent = await sendCatalogGapEmail({ coverage, missing, now, force });
  return {
    skipped: !!sent.skipped,
    sent: !!sent.ok,
    reason: sent.reason,
    coverage,
    missing_total: missing.total,
    rows: missing.rows.length,
    to: sent.to,
    subject: sent.subject,
  };
}

module.exports = {
  DEFAULT_TO,
  hourInMadrid,
  weekdayInMadrid,
  madridDateIso,
  formatPct,
  buildEmail,
  runCatalogGapReport,
  sendCatalogGapEmail,
};
