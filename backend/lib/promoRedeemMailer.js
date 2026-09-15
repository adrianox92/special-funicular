'use strict';

const { getAdminEmails } = require('./licenseAdminAuth');

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

function formatWhen(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return String(iso || '');
  return date.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
}

function adminLicensesUrl() {
  const base = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  return base ? `${base}/admin/lap-timer-licenses` : null;
}

/**
 * Notifica a los admins cuando se canjea un código promo de Slot Lap Timer.
 * No lanza: el canje no debe fallar si el email no se puede enviar.
 * @returns {Promise<{ ok: boolean, skipped?: boolean }>}
 */
async function sendPromoRedeemedEmail({
  promoId,
  code,
  assignedEmail,
  userId,
  note,
  redeemedAt,
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[promoCodes] RESEND_API_KEY no configurado; no se envía email de canje');
    return { ok: false, skipped: true };
  }

  const recipients = getAdminEmails();
  if (recipients.length === 0) {
    console.warn('[promoCodes] LICENSE_ADMIN_EMAILS vacío; no se envía email de canje');
    return { ok: false, skipped: true };
  }

  const safeCode = escapeHtml(code || '');
  const safeEmail = escapeHtml(assignedEmail || '');
  const safeUserId = escapeHtml(userId || '');
  const safeNote = note ? escapeHtml(String(note).slice(0, 500)) : '';
  const when = formatWhen(redeemedAt);
  const licensesUrl = adminLicensesUrl();

  const subject = `Código promo canjeado — Slot Lap Timer (${assignedEmail})`;
  const textLines = [
    'Se ha canjeado un código promocional de Slot Lap Timer Premium.',
    '',
    `Código: ${code || ''}`,
    `Email: ${assignedEmail || ''}`,
    `Usuario: ${userId || ''}`,
    `Fecha: ${when}`,
  ];
  if (note) textLines.push(`Nota: ${String(note).slice(0, 500)}`);
  if (licensesUrl) textLines.push('', `Ver códigos: ${licensesUrl}`);
  textLines.push('', 'Slot Database');

  const html = `
<!DOCTYPE html>
<html lang="es" dir="ltr">
<head><title>${escapeHtml(subject)}</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;font-size:16px;">
  <div lang="es" dir="ltr">
    <h1 style="font-size:20px;">Código promocional canjeado</h1>
    <p>Un usuario ha canjeado un código Premium de <strong>Slot Lap Timer</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Código</td><td><code style="font-size:16px;">${safeCode}</code></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Email</td><td>${safeEmail}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Usuario</td><td>${safeUserId}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555;">Fecha</td><td>${escapeHtml(when)}</td></tr>
      ${safeNote ? `<tr><td style="padding:4px 12px 4px 0;color:#555;">Nota</td><td>${safeNote}</td></tr>` : ''}
    </table>
    ${licensesUrl ? `<p><a href="${escapeHtml(licensesUrl)}">Ver códigos promocionales</a></p>` : ''}
    <p style="color:#666;font-size:13px;">Slot Database</p>
  </div>
</body>
</html>`;

  try {
    const headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    if (promoId != null && String(promoId).trim()) {
      headers['Idempotency-Key'] = `promo-redeemed/${String(promoId).slice(0, 200)}`;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: getFromAddress(),
        to: recipients,
        subject,
        html,
        text: textLines.join('\n'),
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[promoCodes] Resend error:', res.status, txt);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error('[promoCodes] Error enviando email de canje:', e.message);
    return { ok: false };
  }
}

function notifyPromoRedeemed(payload) {
  return sendPromoRedeemedEmail(payload).catch((err) => {
    console.error('[promoCodes] notify redeem:', err);
    return { ok: false };
  });
}

module.exports = { sendPromoRedeemedEmail, notifyPromoRedeemed };
