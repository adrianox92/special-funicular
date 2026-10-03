/**
 * Construye el texto de contexto para la IA a partir de guide-data*.json
 * (misma semántica que frontend/src/content/helpGuide.js → getHelpGuidePlainText).
 */
const { getHelpCopy } = require('./helpCopy');

/**
 * @param {object} data - guide-data.json
 * @param {{ includeAdminSections?: boolean, locale?: string }} [options]
 */
function buildHelpGuidePlainText(data, options = {}) {
  const { includeAdminSections = false, locale = 'es' } = options;
  if (!data || !data.sections) return '';
  const headers = getHelpCopy(locale).headers;
  const lines = [];
  const primeros = data.primerosPasos;
  lines.push(`# ${headers.guideTitle}\n`);
  lines.push(`## ${headers.firstSteps}\n`);
  lines.push(primeros.intro);
  primeros.steps.forEach((st, i) => {
    lines.push(`${i + 1}. ${st.title}: ${st.body}`);
  });
  lines.push('');
  for (const sec of data.sections) {
    if (sec.adminOnly && !includeAdminSections) continue;
    lines.push(`## ${sec.title} (${sec.pathBadge})`);
    lines.push(sec.description);
    lines.push(sec.intro);
    if (sec.steps?.length) {
      lines.push(headers.steps);
      sec.steps.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    }
    if (sec.tips?.length) {
      lines.push(headers.tips);
      sec.tips.forEach((t) => lines.push(`- ${t}`));
    }
    if (sec.qa?.length) {
      lines.push(headers.qa);
      sec.qa.forEach((t) => lines.push(`- ${t}`));
    }
    lines.push('');
  }
  lines.push(`## ${headers.faq}\n`);
  for (const f of data.faq || []) {
    lines.push(`Q: ${f.question}`);
    if (f.keywords?.length) {
      lines.push(`${headers.related}: ${f.keywords.join(', ')}.`);
    }
    f.answerSteps.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = { buildHelpGuidePlainText };
