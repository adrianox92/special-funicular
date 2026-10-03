import i18n from '../i18n';
import guideDataEs from './guide-data.json';
import guideDataEn from './guide-data.en.json';
import guideDataDe from './guide-data.de.json';

const GUIDE_BY_LOCALE = {
  es: guideDataEs,
  en: guideDataEn,
  de: guideDataDe,
};

export function normalizeHelpLocale(locale) {
  const code = String(locale || i18n.language || 'es').split('-')[0];
  return GUIDE_BY_LOCALE[code] ? code : 'es';
}

export function getGuideData(locale) {
  return GUIDE_BY_LOCALE[normalizeHelpLocale(locale)] || guideDataEs;
}

/** Compatibilidad con tests y imports existentes (contenido ES). */
export const primerosPasos = guideDataEs.primerosPasos;
export const helpSections = guideDataEs.sections;
export const helpFaq = guideDataEs.faq;

function visibleSectionsFrom(data, isAdmin) {
  return (data.sections || []).filter((s) => !s.adminOnly || isAdmin);
}

/** Secciones visibles según rol (p. ej. catálogo admin solo para administradores). */
export function visibleHelpSections(isAdmin, locale) {
  return visibleSectionsFrom(getGuideData(locale), isAdmin);
}

/** Índice para la página: primeros pasos + secciones principales */
export function getHelpTableOfContents(isAdmin, locale) {
  const data = getGuideData(locale);
  return [
    { id: 'primeros-pasos', label: data.primerosPasos.title },
    ...visibleSectionsFrom(data, isAdmin).map((s) => ({ id: s.id, label: s.title })),
  ];
}

function plainHeaders(locale) {
  const t = (key, fallback) => i18n.t(key, { ns: 'help', lng: normalizeHelpLocale(locale), defaultValue: fallback });
  return {
    guideTitle: t('plain.guideTitle', 'Slot Database — Guía y onboarding'),
    firstSteps: t('plain.firstSteps', 'Primeros pasos'),
    steps: t('plain.steps', 'Pasos:'),
    tips: t('plain.tips', 'Consejos:'),
    qa: t('plain.qa', 'Comportamiento esperado (QA):'),
    faq: t('plain.faq', 'Preguntas frecuentes'),
    related: (topics) =>
      t('plain.related', 'Temas relacionados: {{topics}}.').replace('{{topics}}', topics),
  };
}

/**
 * Texto plano para IA y emparejamiento (frontend).
 */
export function getHelpGuidePlainText(isAdmin = false, locale) {
  const data = getGuideData(locale);
  const headers = plainHeaders(locale);
  const lines = [];
  const primeros = data.primerosPasos;
  lines.push(`# ${headers.guideTitle}\n`);
  lines.push(`## ${headers.firstSteps}\n`);
  lines.push(primeros.intro);
  primeros.steps.forEach((st, i) => {
    lines.push(`${i + 1}. ${st.title}: ${st.body}`);
  });
  lines.push('');
  for (const sec of visibleSectionsFrom(data, isAdmin)) {
    lines.push(`## ${sec.title} (${sec.pathBadge})`);
    lines.push(sec.description);
    lines.push(sec.intro);
    if (sec.steps?.length) {
      lines.push(headers.steps);
      sec.steps.forEach((text, i) => lines.push(`${i + 1}. ${text}`));
    }
    if (sec.tips?.length) {
      lines.push(headers.tips);
      sec.tips.forEach((text) => lines.push(`- ${text}`));
    }
    if (sec.qa?.length) {
      lines.push(headers.qa);
      sec.qa.forEach((text) => lines.push(`- ${text}`));
    }
    lines.push('');
  }
  lines.push(`## ${headers.faq}\n`);
  for (const f of data.faq || []) {
    lines.push(`Q: ${f.question}`);
    if (f.keywords?.length) {
      lines.push(headers.related(f.keywords.join(', ')));
    }
    f.answerSteps.forEach((text, i) => lines.push(`${i + 1}. ${text}`));
    lines.push('');
  }
  return lines.join('\n');
}

export function getSectionById(id, isAdmin = false, locale) {
  const sec = getGuideData(locale).sections.find((s) => s.id === id);
  if (!sec) return undefined;
  if (sec.adminOnly && !isAdmin) return undefined;
  return sec;
}

export function getPrimerosPasos(locale) {
  return getGuideData(locale).primerosPasos;
}
