/**
 * Construye el texto de contexto para la IA a partir de guide-data.json
 * (misma semántica que frontend/src/content/helpGuide.js → getHelpGuidePlainText).
 */
/**
 * @param {object} data - guide-data.json
 * @param {{ includeAdminSections?: boolean }} [options]
 */
function buildHelpGuidePlainText(data, options = {}) {
  const { includeAdminSections = false } = options;
  if (!data || !data.sections) return '';
  const lines = [];
  const primeros = data.primerosPasos;
  lines.push('# Slot Collection Pro — Guía y onboarding\n');
  lines.push('## Primeros pasos\n');
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
      lines.push('Pasos:');
      sec.steps.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    }
    if (sec.tips?.length) {
      lines.push('Consejos:');
      sec.tips.forEach((t) => lines.push(`- ${t}`));
    }
    lines.push('');
  }
  lines.push('## Preguntas frecuentes\n');
  for (const f of data.faq || []) {
    lines.push(`Q: ${f.question}`);
    if (f.keywords?.length) {
      lines.push(`Temas relacionados: ${f.keywords.join(', ')}.`);
    }
    f.answerSteps.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = { buildHelpGuidePlainText };
