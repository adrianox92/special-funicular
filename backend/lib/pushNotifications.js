const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabaseAdmin = createClient(process.env.SUPABASE_URL, supabaseKey);

let vapidConfigured = false;

function ensureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@scalextric-collection.local';
  if (!publicKey || !privateKey) {
    return false;
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  return true;
}

function isVapidReady() {
  return ensureVapid();
}

/**
 * @param {string} userId
 * @param {{ title: string, body: string, data?: Record<string, string> }} payload
 * @returns {Promise<{ sent: number, failed: number }>}
 */
async function sendPushToUser(userId, payload) {
  if (!isVapidReady()) {
    console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas; se omite el envío');
    return { sent: 0, failed: 0 };
  }

  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    console.error('[push] Error al leer suscripciones:', error.message);
    return { sent: 0, failed: 0 };
  }
  if (!subs?.length) {
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, body, {
        TTL: 60 * 60,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      const status = err.statusCode;
      if (status === 404 || status === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
      }
      console.warn('[push] Fallo al enviar:', status || err.message);
    }
  }

  return { sent, failed };
}

module.exports = {
  sendPushToUser,
  isVapidReady,
  getVapidPublicKey: () => process.env.VAPID_PUBLIC_KEY || null,
};
