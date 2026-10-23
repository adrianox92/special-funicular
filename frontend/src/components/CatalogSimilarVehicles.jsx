import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PublicCatalogItemCard from './PublicCatalogItemCard';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './ui/carousel';

const MD_QUERY = '(min-width: 768px)';
const SIMILAR_MIN = 2;
const SIMILAR_MAX = 4;

function readMdUp() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(MD_QUERY).matches;
}

function useMdUp() {
  const [mdUp, setMdUp] = useState(readMdUp);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(MD_QUERY);
    const onChange = () => setMdUp(mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return mdUp;
}

function readyItems(items) {
  const rows = (Array.isArray(items) ? items : []).filter((row) => row && row.id);
  if (rows.length < SIMILAR_MIN) return [];
  return rows.slice(0, SIMILAR_MAX);
}

function gridColsClass(count) {
  if (count >= 4) return 'grid-cols-4';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-2';
}

/**
 * 2–4 fichas del mismo modelo y tipo. Escritorio: una fila.
 * Móvil: carrusel de un ítem, flechas dentro del bloque, sin loop.
 */
export default function CatalogSimilarVehicles({ items }) {
  const { t } = useTranslation('catalog');
  const mdUp = useMdUp();
  const rows = readyItems(items);
  if (rows.length < SIMILAR_MIN) return null;

  return (
    <section aria-labelledby="catalog-similar-title" className="space-y-3">
      <h2 id="catalog-similar-title" className="text-xl font-semibold tracking-tight">
        {t('detail.similarTitle')}
      </h2>
      {mdUp ? (
        <div
          data-testid="catalog-similar-grid"
          className={`grid gap-4 ${gridColsClass(rows.length)}`}
        >
          {rows.map((row) => (
            <PublicCatalogItemCard key={row.id} row={row} descriptiveAlt />
          ))}
        </div>
      ) : (
        <Carousel
          opts={{ loop: false, align: 'start' }}
          aria-label={t('detail.similarAria')}
          className="w-full"
        >
          <CarouselContent>
            {rows.map((row) => (
              <CarouselItem key={row.id}>
                <PublicCatalogItemCard row={row} descriptiveAlt />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 z-10 bg-background shadow-sm" />
          <CarouselNext className="right-2 z-10 bg-background shadow-sm" />
        </Carousel>
      )}
    </section>
  );
}
