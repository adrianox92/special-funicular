import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { catalogSlugify } from '../utils/catalogSlug';
import { localizePath } from '../i18n/localeUtils';
import { useLocale } from '../hooks/useLocale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function itemTo(locale, neighbor) {
  if (!neighbor?.id) return null;
  const slug = catalogSlugify(neighbor.model_name || neighbor.reference);
  return localizePath(locale, `/catalogo/${neighbor.id}/${slug}`);
}

function label(neighbor) {
  return [neighbor.manufacturer, neighbor.reference || neighbor.model_name].filter(Boolean).join(' · ');
}

/**
 * Enlaces reales <a href> a fichas vecinas (orden: marca, referencia, id).
 */
export default function CatalogPrevNext({ neighbors }) {
  const { t } = useTranslation('catalog');
  const { locale } = useLocale();
  const prev = neighbors?.prev;
  const next = neighbors?.next;
  const prevHref = itemTo(locale, prev);
  const nextHref = itemTo(locale, next);

  if (!prevHref && !nextHref) return null;

  return (
    <nav
      className="flex flex-wrap items-stretch justify-between gap-3 pt-2"
      aria-label={`${t('previous')} / ${t('next')}`}
    >
      {prevHref ? (
        <Link
          to={prevHref}
          className="inline-flex min-w-0 max-w-full flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">{t('previous')}</span>
            <span className="block truncate font-medium">{label(prev)}</span>
          </span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {nextHref ? (
        <Link
          to={nextHref}
          className="inline-flex min-w-0 max-w-full flex-1 items-center justify-end gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 text-right">
            <span className="block text-xs text-muted-foreground">{t('next')}</span>
            <span className="block truncate font-medium">{label(next)}</span>
          </span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
