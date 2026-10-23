import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { CATALOG_ALIAS_TYPES, emptyCatalogAlias } from '../data/catalogAliases';

export default function CatalogAliasesFields({ aliases, setAliases, idPrefix = 'catalog-alias' }) {
  const { t } = useTranslation('catalog');

  const updateAt = (index, patch) => {
    setAliases((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-muted-foreground">{t('aliases.help')}</p>
      {(!aliases || aliases.length === 0) && (
        <p className="text-sm text-muted-foreground">{t('aliases.empty')}</p>
      )}
      {(aliases || []).map((row, index) => (
        <div
          key={row.id || `new-${index}`}
          className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-${index}-ref`}>{t('aliases.reference')}</Label>
            <Input
              id={`${idPrefix}-${index}-ref`}
              className="font-mono"
              value={row.alias_reference}
              onChange={(e) => updateAt(index, { alias_reference: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-${index}-type`}>{t('aliases.type')}</Label>
            <Select
              value={row.alias_type || 'market'}
              onValueChange={(alias_type) => updateAt(index, { alias_type })}
            >
              <SelectTrigger id={`${idPrefix}-${index}-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATALOG_ALIAS_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`aliases.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-${index}-market`}>{t('aliases.market')}</Label>
            <Input
              id={`${idPrefix}-${index}-market`}
              placeholder="ES / INT"
              value={row.market}
              onChange={(e) => updateAt(index, { market: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-${index}-ean`}>{t('aliases.ean')}</Label>
            <Input
              id={`${idPrefix}-${index}-ean`}
              className="font-mono"
              inputMode="numeric"
              value={row.ean}
              onChange={(e) => updateAt(index, { ean: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${idPrefix}-${index}-brand`}>{t('aliases.brandLabel')}</Label>
            <Input
              id={`${idPrefix}-${index}-brand`}
              value={row.brand_label}
              onChange={(e) => updateAt(index, { brand_label: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-${index}-source`}>{t('aliases.source')}</Label>
            <Input
              id={`${idPrefix}-${index}-source`}
              value={row.source}
              onChange={(e) => updateAt(index, { source: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-${index}-url`}>{t('aliases.sourceUrl')}</Label>
            <Input
              id={`${idPrefix}-${index}-url`}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={row.source_url}
              onChange={(e) => updateAt(index, { source_url: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAliases((prev) => prev.filter((_, i) => i !== index))}
            >
              {t('aliases.remove')}
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setAliases((prev) => [...(prev || []), emptyCatalogAlias()])}
      >
        {t('aliases.add')}
      </Button>
    </div>
  );
}
