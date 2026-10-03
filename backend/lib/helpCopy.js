'use strict';

const COPY = {
  es: {
    questionLength: 'La pregunta debe tener entre 3 y 900 caracteres.',
    unavailable: 'El asistente de ayuda no está disponible en el servidor.',
    noGuide: 'No hay guía cargada. Di que no tienes contexto suficiente.',
    openaiError: 'No se pudo obtener respuesta. Inténtalo más tarde.',
    emptyAnswer: 'Respuesta vacía. Inténtalo de nuevo.',
    genericError: 'Error al obtener la respuesta. Inténtalo más tarde.',
    languageName: 'español',
    systemLead:
      'Eres el asistente de ayuda de la aplicación web Slot Database (gestión de colección slot/coches, tiempos, circuitos, inventario y competiciones).',
    systemRules:
      'Responde SIEMPRE en español, de forma breve y con pasos numerados cuando proceda.\nUsa ÚNICAMENTE la información del siguiente contexto de ayuda. Si la pregunta no puede responderse con ese contexto, dilo claramente y sugiere revisar las secciones relevantes (Inicio, Vehículos, Tiempos, etc.) sin inventar funciones que no aparezcan en la guía.\nNo inventes enlaces URL concretos; puedes mencionar nombres de secciones del menú.',
    headers: {
      guideTitle: 'Slot Database — Guía y onboarding',
      firstSteps: 'Primeros pasos',
      steps: 'Pasos:',
      tips: 'Consejos:',
      qa: 'Comportamiento esperado (QA):',
      faq: 'Preguntas frecuentes',
      related: 'Temas relacionados',
    },
  },
  en: {
    questionLength: 'The question must be between 3 and 900 characters.',
    unavailable: 'The help assistant is not available on the server.',
    noGuide: 'No guide is loaded. Say that you do not have enough context.',
    openaiError: 'Could not get a response. Please try again later.',
    emptyAnswer: 'Empty response. Please try again.',
    genericError: 'Error getting the response. Please try again later.',
    languageName: 'English',
    systemLead:
      'You are the help assistant for the Slot Database web app (slot-car collection, timings, circuits, inventory and competitions).',
    systemRules:
      'ALWAYS reply in English, briefly, with numbered steps when useful.\nUse ONLY the information in the following help context. If the question cannot be answered from that context, say so clearly and suggest reviewing the relevant sections (Home, Vehicles, Timings, etc.) without inventing features that are not in the guide.\nDo not invent concrete URLs; you may mention menu section names.',
    headers: {
      guideTitle: 'Slot Database — Guide and onboarding',
      firstSteps: 'Getting started',
      steps: 'Steps:',
      tips: 'Tips:',
      qa: 'Expected behaviour (QA):',
      faq: 'Frequently asked questions',
      related: 'Related topics',
    },
  },
  de: {
    questionLength: 'Die Frage muss zwischen 3 und 900 Zeichen lang sein.',
    unavailable: 'Der Hilfe-Assistent ist auf dem Server nicht verfügbar.',
    noGuide: 'Es ist kein Leitfaden geladen. Sage, dass du nicht genug Kontext hast.',
    openaiError: 'Antwort konnte nicht geholt werden. Bitte später erneut versuchen.',
    emptyAnswer: 'Leere Antwort. Bitte erneut versuchen.',
    genericError: 'Fehler beim Holen der Antwort. Bitte später erneut versuchen.',
    languageName: 'Deutsch',
    systemLead:
      'Du bist der Hilfe-Assistent der Web-App Slot Database (Slot-Sammlung, Zeiten, Strecken, Inventar und Wettbewerbe).',
    systemRules:
      'Antworte IMMER auf Deutsch, kurz und mit nummerierten Schritten, wenn es sinnvoll ist.\nVerwende NUR die Informationen aus dem folgenden Hilfe-Kontext. Kann die Frage damit nicht beantwortet werden, sage das klar und schlage vor, die relevanten Abschnitte (Start, Fahrzeuge, Zeiten usw.) zu prüfen, ohne Funktionen zu erfinden, die nicht in der Anleitung stehen.\nErfinde keine konkreten URLs; du darfst Menüabschnitte nennen.',
    headers: {
      guideTitle: 'Slot Database — Leitfaden und Einstieg',
      firstSteps: 'Erste Schritte',
      steps: 'Schritte:',
      tips: 'Tipps:',
      qa: 'Erwartetes Verhalten (QA):',
      faq: 'Häufige Fragen',
      related: 'Verwandte Themen',
    },
  },
};

function normalizeHelpLocale(locale) {
  const code = String(locale || 'es').split('-')[0].toLowerCase();
  return COPY[code] ? code : 'es';
}

function getHelpCopy(locale) {
  return COPY[normalizeHelpLocale(locale)];
}

module.exports = { COPY, normalizeHelpLocale, getHelpCopy };
