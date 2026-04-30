const express = require('express');
const nodemailer = require('nodemailer');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validateRequest');

const router = express.Router();

function isHoneypotTripped(req) {
  const w = req.body?.website;
  return w != null && String(w).trim() !== '';
}

function smtpSecureFromEnv() {
  const raw = process.env.SMTP_SECURE;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  return port === 465;
}

function getMailConfig() {
  const contactTo = process.env.CONTACT_TO;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!contactTo || !host || !user || !pass) return null;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = smtpSecureFromEnv();
  const from = process.env.CONTACT_FROM || user;
  return { contactTo, host, port, secure, user, pass, from };
}

function createTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

const contactValidators = [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio.').isLength({ max: 200 }),
  body('email').trim().isEmail().withMessage('Introduce un correo válido.').isLength({ max: 320 }),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('El mensaje es obligatorio.')
    .isLength({ min: 10, max: 10000 })
    .withMessage('El mensaje debe tener entre 10 y 10000 caracteres.'),
];

router.post('/', (req, res, next) => {
  if (isHoneypotTripped(req)) {
    return res.json({ ok: true });
  }
  next();
}, contactValidators, handleValidationErrors, async (req, res) => {
  const cfg = getMailConfig();
  if (!cfg) {
    console.warn('[contact] SMTP no configurado: faltan CONTACT_TO, SMTP_HOST, SMTP_USER o SMTP_PASS');
    return res.status(503).json({
      error:
        'El envío de correo no está configurado en el servidor. Vuelve a intentarlo más tarde o escribe directamente al titular del servicio.',
    });
  }

  const { name, email, message } = req.body;
  const subject = `[Slot Database] Contacto: ${name}`;
  const text = [
    `Nombre: ${name}`,
    `Correo del remitente: ${email}`,
    '',
    'Mensaje:',
    message,
  ].join('\n');

  try {
    const transport = createTransport(cfg);
    await transport.sendMail({
      from: cfg.from,
      to: cfg.contactTo,
      replyTo: email,
      subject,
      text,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[contact] Error al enviar correo:', err.message);
    return res.status(500).json({ error: 'No se pudo enviar el mensaje. Inténtalo más tarde.' });
  }
});

module.exports = router;
