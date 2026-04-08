import guideData from './guide-data.json';

export const primerosPasos = guideData.primerosPasos;
export const helpSections = guideData.sections;
export const helpFaq = guideData.faq;

/** Índice para la página: primeros pasos + secciones principales */
export const helpTableOfContents = [
  { id: 'primeros-pasos', label: primerosPasos.title },
  ...helpSections.map((s) => ({ id: s.id, label: s.title })),
];

/**
 * Texto plano para IA y emparejamiento (frontend).
 */
export function getHelpGuidePlainText() {
  const lines = [];
  lines.push('# Slot Collection Pro — Guía y onboarding\n');
  lines.push('## Primeros pasos\n');
  lines.push(primerosPasos.intro);
  primerosPasos.steps.forEach((st, i) => {
    lines.push(`${i + 1}. ${st.title}: ${st.body}`);
  });
  lines.push('');
  for (const sec of helpSections) {
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
  for (const f of helpFaq) {
    lines.push(`Q: ${f.question}`);
    if (f.keywords?.length) {
      lines.push(`Temas relacionados: ${f.keywords.join(', ')}.`);
    }
    f.answerSteps.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
    lines.push('');
  }
  return lines.join('\n');
}

export function getSectionById(id) {
  return helpSections.find((s) => s.id === id);
}
