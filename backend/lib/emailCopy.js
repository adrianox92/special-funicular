'use strict';

const COPY = {
  es: {
    waitlist: {
      fallbackCompetition: 'la competición',
      subject: 'Plaza disponible — {{competition}}',
      greetingNamed: 'Hola {{name}},',
      greeting: 'Hola,',
      body: 'Se ha liberado una plaza en <strong>{{competition}}</strong>. Tu solicitud pasa a estar <strong>pendiente de aprobación</strong> por el organizador.',
      cta: 'Ver la página de la competición',
    },
    digest: {
      noChannels:
        'Configura al menos un webhook de Discord o tu Chat ID de Telegram para recibir el resumen.',
      title: '📊 **Resumen semanal — Scalextric Collection**',
      sessions: 'Sesiones (7 días): {{count}}',
      guided: 'Entrenamientos guiados: {{count}}',
      newPbs: '**Nuevos PB:**',
      pbLine: '• {{vehicle}} — {{circuit}} (carril {{lane}}): {{time}} (−{{improvement}}s)',
      goals: '**Metas de entrenamiento:**',
      goalLap: 'PB objetivo {{value}}s',
      goalConsistency: 'Consistencia ≤ {{value}}%',
      goalAchieved: '✅ lograda',
      maintenance: '⚠️ Mantenimiento pendiente en {{count}} registro(s) antiguo(s).',
      vehicleFallback: 'Vehículo',
    },
  },
  en: {
    waitlist: {
      fallbackCompetition: 'the competition',
      subject: 'A spot is available — {{competition}}',
      greetingNamed: 'Hi {{name}},',
      greeting: 'Hi,',
      body: 'A spot has opened in <strong>{{competition}}</strong>. Your request is now <strong>pending organiser approval</strong>.',
      cta: 'View the competition page',
    },
    digest: {
      noChannels:
        'Configure at least a Discord webhook or your Telegram Chat ID to receive the digest.',
      title: '📊 **Weekly digest — Scalextric Collection**',
      sessions: 'Sessions (7 days): {{count}}',
      guided: 'Guided training: {{count}}',
      newPbs: '**New PBs:**',
      pbLine: '• {{vehicle}} — {{circuit}} (lane {{lane}}): {{time}} (−{{improvement}}s)',
      goals: '**Training goals:**',
      goalLap: 'Target PB {{value}}s',
      goalConsistency: 'Consistency ≤ {{value}}%',
      goalAchieved: '✅ achieved',
      maintenance: '⚠️ Maintenance pending on {{count}} old record(s).',
      vehicleFallback: 'Vehicle',
    },
  },
  de: {
    waitlist: {
      fallbackCompetition: 'dem Wettbewerb',
      subject: 'Platz frei — {{competition}}',
      greetingNamed: 'Hallo {{name}},',
      greeting: 'Hallo,',
      body: 'In <strong>{{competition}}</strong> ist ein Platz frei geworden. Deine Anfrage ist jetzt <strong>zur Freigabe durch den Organisator ausstehend</strong>.',
      cta: 'Wettbewerbsseite ansehen',
    },
    digest: {
      noChannels:
        'Richte mindestens einen Discord-Webhook oder deine Telegram-Chat-ID ein, um die Zusammenfassung zu erhalten.',
      title: '📊 **Wochenübersicht — Scalextric Collection**',
      sessions: 'Sitzungen (7 Tage): {{count}}',
      guided: 'Geführtes Training: {{count}}',
      newPbs: '**Neue PB:**',
      pbLine: '• {{vehicle}} — {{circuit}} (Spur {{lane}}): {{time}} (−{{improvement}}s)',
      goals: '**Trainingsziele:**',
      goalLap: 'Ziel-PB {{value}}s',
      goalConsistency: 'Konstanz ≤ {{value}}%',
      goalAchieved: '✅ erreicht',
      maintenance: '⚠️ Wartung ausstehend bei {{count}} altem/n Datensatz/sätzen.',
      vehicleFallback: 'Fahrzeug',
    },
  },
};

function interpolate(template, vars = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] == null ? '' : String(vars[key]),
  );
}

function normalizeEmailLocale(locale) {
  const code = String(locale || 'es').split('-')[0].toLowerCase();
  return COPY[code] ? code : 'es';
}

function getEmailCopy(locale) {
  return COPY[normalizeEmailLocale(locale)];
}

module.exports = { COPY, interpolate, normalizeEmailLocale, getEmailCopy };
