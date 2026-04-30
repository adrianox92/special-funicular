const express = require('express');
const path = require('path');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { helpAskLimiter } = require('../middleware/rateLimits');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { buildHelpGuidePlainText } = require('../lib/helpGuideText');
const { isLicenseAdminUser } = require('../lib/licenseAdminAuth');

const router = express.Router();

function loadGuideData() {
  try {
    // Monorepo: API y frontend en el mismo checkout
    return require(path.join(__dirname, '../../frontend/src/content/guide-data.json'));
  } catch (e) {
    console.warn('[help] No se pudo cargar guide-data.json:', e.message);
    return null;
  }
}

router.get('/status', authMiddleware, (req, res) => {
  res.json({ available: Boolean(process.env.OPENAI_API_KEY?.trim()) });
});

router.post(
  '/ask',
  authMiddleware,
  helpAskLimiter,
  body('question').trim().isLength({ min: 3, max: 900 }).withMessage('La pregunta debe tener entre 3 y 900 caracteres.'),
  handleValidationErrors,
  async (req, res) => {
    const question = req.body.question;
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(200).json({
        available: false,
        answer: null,
        message: 'El asistente de ayuda no está disponible en el servidor.',
      });
    }

    const guideData = loadGuideData();
    const includeAdminSections = isLicenseAdminUser(req.user);
    const context = guideData
      ? buildHelpGuidePlainText(guideData, { includeAdminSections })
      : 'No hay guía cargada. Di que no tienes contexto suficiente.';

    const systemPrompt = `Eres el asistente de ayuda de la aplicación web Slot Database (gestión de colección slot/coches, tiempos, circuitos, inventario y competiciones).
Responde SIEMPRE en español, de forma breve y con pasos numerados cuando proceda.
Usa ÚNICAMENTE la información del siguiente contexto de ayuda. Si la pregunta no puede responderse con ese contexto, dilo claramente y sugiere revisar las secciones relevantes (Inicio, Vehículos, Tiempos, etc.) sin inventar funciones que no aparezcan en la guía.
No inventes enlaces URL concretos; puedes mencionar nombres de secciones del menú.

--- CONTEXTO DE AYUDA ---
${context}
--- FIN CONTEXTO ---`;

    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_HELP_MODEL || 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 800,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('[help] OpenAI error', r.status, errText);
        return res.status(502).json({ error: 'No se pudo obtener respuesta. Inténtalo más tarde.' });
      }

      const data = await r.json();
      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (!answer) {
        return res.status(502).json({ error: 'Respuesta vacía. Inténtalo de nuevo.' });
      }

      return res.json({ available: true, answer });
    } catch (e) {
      console.error('[help] ask', e);
      return res.status(502).json({ error: 'Error al obtener la respuesta. Inténtalo más tarde.' });
    }
  },
);

module.exports = router;
