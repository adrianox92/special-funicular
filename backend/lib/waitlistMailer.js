'use strict';

const { getEmailCopy, interpolate } = require('./emailCopy');

/**
 * Envía email cuando un depósito pasa de lista de espera a pendiente de aprobación (Resend API).
 * @returns {Promise<{ ok: boolean, skipped?: boolean }>}
 */
async function sendWaitlistPromotionEmail({ to, name, competitionName, signupUrl, locale }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[waitlist] RESEND_API_KEY no configurado; no se envía email de lista de espera');
    return { ok: false, skipped: true };
  }

  const from =
    process.env.RESEND_FROM ||
    process.env.CONTACT_FROM ||
    'Slot Database <onboarding@resend.dev>';

  const copy = getEmailCopy(locale);
  const safeName = name ? String(name).slice(0, 120) : '';
  const safeComp = competitionName
    ? String(competitionName).slice(0, 200)
    : copy.waitlist.fallbackCompetition;
  const subject = interpolate(copy.waitlist.subject, { competition: safeComp });
  const greeting = safeName
    ? interpolate(copy.waitlist.greetingNamed, { name: safeName })
    : copy.waitlist.greeting;
  const body = interpolate(copy.waitlist.body, { competition: safeComp });
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;">
  <p>${greeting}</p>
  <p>${body}</p>
  <p><a href="${signupUrl}">${copy.waitlist.cta}</a></p>
  <p style="color:#666;font-size:13px;">Slot Database</p>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[waitlist] Resend error:', res.status, txt);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error('[waitlist] Error enviando email:', e.message);
    return { ok: false };
  }
}

module.exports = { sendWaitlistPromotionEmail };
