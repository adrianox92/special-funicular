const express = require('express');
const path = require('path');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { helpAskLimiter } = require('../middleware/rateLimits');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { buildHelpGuidePlainText } = require('../lib/helpGuideText');
const { getHelpCopy, normalizeHelpLocale } = require('../lib/helpCopy');
const { isLicenseAdminUser } = require('../lib/licenseAdminAuth');

const router = express.Router();

const GUIDE_FILES = {
  es: 'guide-data.json',
  en: 'guide-data.en.json',
  de: 'guide-data.de.json',
};

function loadGuideData(locale) {
  const code = normalizeHelpLocale(locale);
  const file = GUIDE_FILES[code] || GUIDE_FILES.es;
  try {
    return require(path.join(__dirname, `../../frontend/src/content/${file}`));
  } catch (e) {
    if (code !== 'es') {
      try {
        return require(path.join(__dirname, '../../frontend/src/content/guide-data.json'));
      } catch (inner) {
        console.warn('[help] No se pudo cargar guide-data.json:', inner.message);
        return null;
      }
    }
    console.warn('[help] No se pudo cargar', file, e.message);
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
  body('locale').optional().isIn(['es', 'en', 'de']),
  body('question')
    .trim()
    .isLength({ min: 3, max: 900 })
    .withMessage((_, { req }) => getHelpCopy(req.body?.locale).questionLength),
  handleValidationErrors,
  async (req, res) => {
    const locale = normalizeHelpLocale(req.body.locale);
    const copy = getHelpCopy(locale);
    const question = req.body.question;
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(200).json({
        available: false,
        answer: null,
        message: copy.unavailable,
      });
    }

    const guideData = loadGuideData(locale);
    const includeAdminSections = isLicenseAdminUser(req.user);
    const context = guideData
      ? buildHelpGuidePlainText(guideData, { includeAdminSections, locale })
      : copy.noGuide;

    const systemPrompt = `${copy.systemLead}
${copy.systemRules}

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
        return res.status(502).json({ error: copy.openaiError });
      }

      const data = await r.json();
      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (!answer) {
        return res.status(502).json({ error: copy.emptyAnswer });
      }

      return res.json({ available: true, answer });
    } catch (e) {
      console.error('[help] ask', e);
      return res.status(502).json({ error: copy.genericError });
    }
  },
);

module.exports = router;
