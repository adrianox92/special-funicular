import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { catalogSlugify } from '../utils/catalogSlug';
import { localizePath } from '../i18n/localeUtils';
import { useLocale } from '../hooks/useLocale';
import { cachedStorageImageUrl } from '../utils/cachedStorageImageUrl';
import CatalogListingImage from './CatalogListingImage';

// CJS: el import con nombre rompe el build de webpack en producción.
const { buildCatalogItemImageAlt } = require('../utils/catalogSeoCopy');

/**
 * Tarjeta de ficha del listado público. El enlace lleva referencia, modelo y marca.
 * `descriptiveAlt` solo en bloques donde el alt aporta (similares); el listado deja alt vacío.
 */
export default function PublicCatalogItemCard({ row, descriptiveAlt = false }) {
  const { t } = useTranslation('catalog');
  const { locale } = useLocale();
  const slug = catalogSlugify(row.model_name || row.reference);
  const href = localizePath(locale, `/catalogo/${row.id}/${slug}`);
  const imageAlt = descriptiveAlt ? buildCatalogItemImageAlt(row, locale) : '';

  return (
    <Link to={href} className="group block h-full">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
          {row.image_url ? (
            <CatalogListingImage
              imageUrl={row.image_url}
              alt={imageAlt}
              className="absolute inset-0 size-full object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              {t('list.noImage')}
            </div>
          )}
        </div>
        <CardContent className="p-4 space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
          <p className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {row.model_name}
          </p>
          <div className="flex items-center gap-1.5">
            {row.manufacturer_logo_url && (
              <img
                src={cachedStorageImageUrl(row.manufacturer_logo_url)}
                alt=""
                className="h-4 w-6 object-contain"
              />
            )}
            <p className="text-sm text-muted-foreground">{row.manufacturer}</p>
          </div>
          {row.rating_avg != null && Number(row.rating_count) > 0 && (
            <p className="text-xs flex items-center gap-1 text-amber-600 dark:text-amber-500">
              <Star className="size-3.5 shrink-0 fill-current" aria-hidden />
              <span>
                {Number(row.rating_avg).toFixed(1)} ({row.rating_count})
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1 text-xs">
            {row.discontinued && (
              <span className="rounded-md bg-muted px-2 py-0.5">{t('list.badgeDiscontinued')}</span>
            )}
            {row.upcoming_release && (
              <span className="rounded-md bg-primary/15 text-primary px-2 py-0.5">
                {t('list.badgeUpcoming')}
              </span>
            )}
            {row.vehicle_type && (
              <span className="rounded-md bg-secondary px-2 py-0.5">
                {t(`values.vehicleTypes.${row.vehicle_type}`, { defaultValue: row.vehicle_type })}
              </span>
            )}
            {row.commercial_release_year != null && (
              <span className="rounded-md bg-secondary px-2 py-0.5">{row.commercial_release_year}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
