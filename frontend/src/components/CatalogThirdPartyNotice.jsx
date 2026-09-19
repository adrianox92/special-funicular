import React from 'react';
import { useTranslation } from 'react-i18next';

const BRAND = 'Slot Database';

/**
 * Aviso sobre marcas, logotipos e imágenes de terceros en el catálogo público.
 */
export default function CatalogThirdPartyNotice() {
  const { t } = useTranslation('catalog');

  return (
    <aside
      className="rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed"
      aria-label={t('notice.aria')}
    >
      <p>{t('notice.body', { brand: BRAND })}</p>
    </aside>
  );
}
