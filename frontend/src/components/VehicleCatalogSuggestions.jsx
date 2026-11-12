import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import CatalogListingImage from './CatalogListingImage';
import { useCatalogVehicleSuggestions } from '../hooks/useCatalogVehicleSuggestions';
import VehicleFieldSwapHint from './VehicleFieldSwapHint';
import { swapModelAndReference } from '../utils/vehicleFieldSwap';

function SuggestionCard({ item, onSelect, t }) {
  const bits = Array.isArray(item.variant_bits) ? item.variant_bits : [];
  return (
    <div className="flex gap-3 rounded-md border bg-background p-2 text-left">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted/50 flex items-center justify-center">
        {item.image_url ? (
          <CatalogListingImage
            imageUrl={item.image_url}
            alt=""
            className="h-16 w-16 object-contain"
            sizes="64px"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground px-1 text-center leading-tight">
            {t('catalogSuggest.noImage')}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-muted-foreground truncate">{item.manufacturer}</p>
        <p className="text-sm font-medium leading-tight">
          <span className="font-mono">{item.reference}</span>
        </p>
        <p className="text-sm leading-snug line-clamp-2">{item.model_name}</p>
        {bits.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bits.map((bit) => (
              <Badge key={bit} variant="secondary" className="font-normal">
                {bit}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 self-center">
        <Button type="button" size="sm" onClick={() => onSelect(item)}>
          {t('catalogSuggest.useThis')}
        </Button>
      </div>
    </div>
  );
}

function SuggestionGroup({ group, onSelect, t }) {
  const items = group.items || [];
  if (items.length === 0) return null;
  const sideBySide = Boolean(group.variant_group && items.length > 1);
  return (
    <div className="space-y-2">
      {sideBySide && (
        <p className="text-xs font-medium text-muted-foreground">{t('catalogSuggest.variantsTitle')}</p>
      )}
      <div className={sideBySide ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-2'}>
        {items.map((item) => (
          <SuggestionCard key={item.id} item={item} onSelect={onSelect} t={t} />
        ))}
      </div>
    </div>
  );
}

export function VehicleCatalogSuggestionList({ groups, onSelect, loading = false }) {
  const { t } = useTranslation('vehicles');
  const hasGroups = (groups || []).some((g) => (g.items || []).length > 0);
  if (!loading && !hasGroups) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t('catalogSuggest.title')}</p>
      <p className="text-xs text-muted-foreground">{t('catalogSuggest.hint')}</p>
      {loading && (
        <p className="text-xs text-muted-foreground">{t('catalogSuggest.searching')}</p>
      )}
      {(groups || []).map((group) => (
        <SuggestionGroup key={group.key} group={group} onSelect={onSelect} t={t} />
      ))}
    </div>
  );
}

/**
 * Sugerencias de catálogo + aviso de campos intercambiados para el formulario de vehículo.
 */
export default function VehicleCatalogAssist({
  manufacturer,
  model,
  reference,
  catalogItemId,
  onSwapFields,
  onSelect,
  enabled = true,
}) {
  const { t } = useTranslation('vehicles');
  const { groups, loading } = useCatalogVehicleSuggestions({
    manufacturer,
    model,
    reference,
    catalogItemId,
    enabled,
  });

  const handleSwap = () => {
    if (typeof onSwapFields !== 'function') return;
    onSwapFields(swapModelAndReference({ manufacturer, model, reference }));
  };

  if (catalogItemId) {
    return <p className="text-xs text-muted-foreground">{t('catalogSuggest.linked')}</p>;
  }

  return (
    <div className="space-y-3">
      <VehicleFieldSwapHint model={model} reference={reference} onSwap={handleSwap} />
      <VehicleCatalogSuggestionList groups={groups} loading={loading} onSelect={onSelect} />
    </div>
  );
}
