/**
 * Categorías de eventos del club (alineadas con public.club_events.event_category y backend).
 */
import i18n from '../i18n';

export const CLUB_EVENT_CATEGORY_IDS = Object.freeze([
  'meeting',
  'competition',
  'training',
  'social',
  'maintenance',
  'other',
]);

const STYLE = {
  meeting: {
    pillClass: 'border border-blue-500/35 bg-blue-500/15 text-blue-900 dark:text-blue-100',
    cardBorderClass: 'border-l-4 border-l-blue-500',
    badgeClass: 'border-blue-500/40 bg-blue-500/15 text-blue-900 dark:text-blue-100',
  },
  competition: {
    pillClass: 'border border-rose-500/40 bg-rose-500/15 text-rose-900 dark:text-rose-100',
    cardBorderClass: 'border-l-4 border-l-rose-500',
    badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-900 dark:text-rose-100',
  },
  training: {
    pillClass: 'border border-emerald-500/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100',
    cardBorderClass: 'border-l-4 border-l-emerald-500',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100',
  },
  social: {
    pillClass: 'border border-violet-500/35 bg-violet-500/15 text-violet-900 dark:text-violet-100',
    cardBorderClass: 'border-l-4 border-l-violet-500',
    badgeClass: 'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100',
  },
  maintenance: {
    pillClass: 'border border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100',
    cardBorderClass: 'border-l-4 border-l-amber-500',
    badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-950 dark:text-amber-100',
  },
  other: {
    pillClass: 'border border-border bg-muted text-foreground',
    cardBorderClass: 'border-l-4 border-l-muted-foreground/50',
    badgeClass: 'border-border bg-muted text-foreground',
  },
};

function categoryLabel(id) {
  const key = `clubEvents.${id}`;
  if (i18n.exists(key, { ns: 'data' })) return i18n.t(key, { ns: 'data' });
  return id;
}

/** @type {Record<string, { label: string; pillClass: string; cardBorderClass: string; badgeClass: string }>} */
export const CLUB_EVENT_CATEGORY_META = Object.fromEntries(
  CLUB_EVENT_CATEGORY_IDS.map((id) => [
    id,
    { label: categoryLabel(id), ...STYLE[id] },
  ]),
);

export function clubEventCategoryMeta(category) {
  const id =
    category && CLUB_EVENT_CATEGORY_IDS.includes(String(category)) ? String(category) : 'other';
  return {
    ...CLUB_EVENT_CATEGORY_META[id],
    label: categoryLabel(id),
  };
}

export const CLUB_EVENT_CATEGORY_OPTIONS = CLUB_EVENT_CATEGORY_IDS.map((value) => ({
  value,
  get label() {
    return categoryLabel(value);
  },
}));
