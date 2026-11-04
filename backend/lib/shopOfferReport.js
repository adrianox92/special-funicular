'use strict';

const DEFAULT_TO = 'adrianpalomera17@gmail.com';
const MAX_ROWS = 800;

function escapeHtml(value) {
  return String(value ?? '')
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
  const raw = process.env.SHOP_OFFER_REPORT_TO || process.env.CATALOG_GAP_REPORT_TO || DEFAULT_TO;
  return String(raw)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function siteOrigin() {
  return (process.env.FRONTEND_URL || process.env.PUBLIC_SITE_ORIGIN || 'https://www.slotdatabase.es')
    .replace(/\/+$/, '');
}

function catalogHref(id) {
  if (!id) return null;
  return `${siteOrigin()}/catalogo/${id}`;
}

function cell(value) {
  const text = value == null || value === '' ? '—' : String(value);
  return escapeHtml(text);
}

function linkCell(href, label) {
  if (!href) return cell(label);
  return `<a href="${escapeHtml(href)}">${cell(label || href)}</a>`;
}

function clip(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    shown: list.slice(0, MAX_ROWS),
    hidden: Math.max(0, list.length - MAX_ROWS),
    total: list.length,
  };
}

function eventRows(rows, { stock = false } = {}) {
  return rows.map((row) => {
    const href = catalogHref(row.catalog_item_id);
    const stockCell = stock
      ? `<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${row.in_stock ? 'En stock' : 'Sin stock'}</td>`
      : '';
    return `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${linkCell(href, row.reference)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${cell(row.model_name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${cell(row.manufacturer)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${cell(row.shop)}</td>
      ${stockCell}
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${linkCell(row.product_url, 'Ficha')}</td>
    </tr>`;
  }).join('');
}

function table(rows, { stock = false, empty }) {
  if (!rows.length) return `<p>${escapeHtml(empty)}</p>`;
  const stockHead = stock
    ? '<th align="left" scope="col" style="padding:8px;border-bottom:2px solid #111;">Stock</th>'
    : '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:760px;">
    <thead>
      <tr>
        <th align="left" scope="col" style="padding:8px;border-bottom:2px solid #111;">Referencia</th>
        <th align="left" scope="col" style="padding:8px;border-bottom:2px solid #111;">Modelo</th>
        <th align="left" scope="col" style="padding:8px;border-bottom:2px solid #111;">Marca</th>
        <th align="left" scope="col" style="padding:8px;border-bottom:2px solid #111;">Tienda</th>
        ${stockHead}
        <th align="left" scope="col" style="padding:8px;border-bottom:2px solid #111;">Enlace</th>
      </tr>
    </thead>
    <tbody>${eventRows(rows, { stock })}</tbody>
  </table>`;
}

function textEvent(row, { stock = false } = {}) {
  const bits = [
    row.reference || 'sin referencia',
    row.model_name,
    row.manufacturer,
    row.shop,
  ].filter(Boolean);
  const href = catalogHref(row.catalog_item_id);
  const tail = [
    stock ? (row.in_stock ? 'en stock' : 'sin stock') : null,
    href,
    row.product_url,
  ].filter(Boolean);
  return `- ${bits.join(' · ')}${tail.length ? ` (${tail.join(' · ')})` : ''}`;
}

function buildShopOfferReport({ summary, now = new Date() }) {
  const created = clip(summary.created);
  const withdrawn = clip(summary.withdrawn);
  const skipped = Array.isArray(summary.skipped) ? summary.skipped : [];
  const when = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(now);

  const noun = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const subjectParts = [
    `Ofertas de tienda: ${noun(created.total, 'nueva', 'nuevas')}, ${noun(withdrawn.total, 'retirada', 'retiradas')}`,
  ];
  if (skipped.length) subjectParts.push(noun(skipped.length, 'tienda omitida', 'tiendas omitidas'));
  const subject = subjectParts.join(' · ');

  const skippedHtml = skipped.length
    ? `<ul>${skipped.map((shop) => `<li><strong>${cell(shop.name || shop.adapter_key || 'Tienda')}</strong> — ${cell(shop.reason)}</li>`).join('')}</ul>`
    : '<p>Ninguna tienda activa se ha omitido.</p>';
  const skippedText = skipped.length
    ? skipped.map((shop) => `- ${shop.name || shop.adapter_key || 'Tienda'}: ${shop.reason}`).join('\n')
    : '- Ninguna';

  const hiddenNote = (block) => (
    block.hidden
      ? `<p>Se muestran ${block.shown.length} de ${block.total}.</p>`
      : ''
  );

  const html = `<!DOCTYPE html>
<html lang="es" dir="ltr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body>
  <div lang="es" dir="ltr" style="font-family:sans-serif;color:#111;line-height:1.45;">
    <p>Resumen del cron de ofertas del ${escapeHtml(when)} (Europe/Madrid).</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:2px 16px 2px 0;">Tiendas revisadas</td><td><strong>${summary.shops ?? 0}</strong></td></tr>
      <tr><td style="padding:2px 16px 2px 0;">Tiendas omitidas</td><td><strong>${summary.skipped_shops ?? skipped.length}</strong></td></tr>
      <tr><td style="padding:2px 16px 2px 0;">Rechecks en stock</td><td><strong>${summary.checked ?? 0}</strong></td></tr>
      <tr><td style="padding:2px 16px 2px 0;">Coincidencias en stock</td><td><strong>${summary.discovered ?? 0}</strong></td></tr>
      <tr><td style="padding:2px 16px 2px 0;">Marcadas sin stock</td><td><strong>${summary.out_of_stock ?? 0}</strong></td></tr>
      <tr><td style="padding:2px 16px 2px 0;">Errores</td><td><strong>${summary.errors ?? 0}</strong></td></tr>
    </table>
    <p style="color:#444;font-size:14px;">Las coincidencias en stock incluyen ofertas que ya existían y solo se refrescaron. Abajo van las altas nuevas y las que dejaron de tener stock.</p>
    <h2 style="font-size:16px;">Tiendas omitidas</h2>
    ${skippedHtml}
    <h2 style="font-size:16px;">Ofertas nuevas (${created.total})</h2>
    ${table(created.shown, { stock: true, empty: 'No se ha creado ninguna oferta en esta ejecución.' })}
    ${hiddenNote(created)}
    <h2 style="font-size:16px;">Ofertas retiradas (${withdrawn.total})</h2>
    ${table(withdrawn.shown, { empty: 'No se ha retirado ninguna oferta que estuviera en stock.' })}
    ${hiddenNote(withdrawn)}
    <p style="color:#666;font-size:13px;">Slot Database · cron diario de stock en tiendas</p>
  </div>
</body>
</html>`;

  const text = [
    subject,
    when,
    '',
    `Tiendas revisadas: ${summary.shops ?? 0}`,
    `Tiendas omitidas: ${summary.skipped_shops ?? skipped.length}`,
    `Rechecks en stock: ${summary.checked ?? 0}`,
    `Coincidencias en stock: ${summary.discovered ?? 0}`,
    `Marcadas sin stock: ${summary.out_of_stock ?? 0}`,
    `Errores: ${summary.errors ?? 0}`,
    '',
    'Tiendas omitidas',
    skippedText,
    '',
    `Ofertas nuevas (${created.total})`,
    created.shown.length ? created.shown.map((row) => textEvent(row, { stock: true })).join('\n') : '- Ninguna',
    created.hidden ? `… y ${created.hidden} más` : null,
    '',
    `Ofertas retiradas (${withdrawn.total})`,
    withdrawn.shown.length ? withdrawn.shown.map((row) => textEvent(row)).join('\n') : '- Ninguna',
    withdrawn.hidden ? `… y ${withdrawn.hidden} más` : null,
  ].filter((line) => line != null).join('\n');

  return { subject, html, text };
}

function publicShopOfferResult(summary, email) {
  const body = {
    shops: summary.shops,
    skipped_shops: summary.skipped_shops,
    skipped: summary.skipped || [],
    checked: summary.checked,
    discovered: summary.discovered,
    out_of_stock: summary.out_of_stock,
    errors: summary.errors,
    created: (summary.created || []).length,
    withdrawn: (summary.withdrawn || []).length,
    email_sent: email?.ok === true,
    email_to: email?.to || null,
  };
  if (!email?.ok) {
    body.created_items = summary.created || [];
    body.withdrawn_items = summary.withdrawn || [];
    body.email_error = email?.reason || null;
  }
  return body;
}

async function sendShopOfferReport({ summary, now = new Date() } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[shop-offers] RESEND_API_KEY no configurado; no se envía el informe');
    return { ok: false, skipped: true, reason: 'no_resend_key' };
  }
  const recipients = getReportRecipients();
  if (recipients.length === 0) {
    console.warn('[shop-offers] SHOP_OFFER_REPORT_TO vacío; no se envía el informe');
    return { ok: false, skipped: true, reason: 'no_recipients' };
  }

  const { subject, html, text } = buildShopOfferReport({ summary, now });
  const idempotencyKey = `shop-offer-report/${now.toISOString()}`.slice(0, 256);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
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
      console.error('[shop-offers] Resend error:', res.status, txt);
      return { ok: false, reason: 'resend_error', status: res.status };
    }
    return { ok: true, to: recipients, subject };
  } catch (err) {
    console.error('[shop-offers] Resend error:', err);
    return { ok: false, reason: 'resend_error' };
  }
}

module.exports = {
  DEFAULT_TO,
  buildShopOfferReport,
  publicShopOfferResult,
  sendShopOfferReport,
  getReportRecipients,
};
