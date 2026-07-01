import React from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../hooks/useLocale';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const LOCALE_FULL_NAMES = {
  es: 'Español',
  en: 'English',
  de: 'Deutsch',
};

/**
 * Selector de idioma con icono de globo y menú desplegable (ES / EN / DE).
 */
function LanguageSelector({ className, size = 'default', variant }) {
  const { locale, setLocale, supportedLocales, localeLabels } = useLocale();
  const { t } = useTranslation('common');

  const compact = size === 'compact';
  const showLabel = variant === 'outline';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={showLabel ? 'outline' : 'ghost'}
          size={showLabel ? (compact ? 'sm' : 'default') : 'icon'}
          className={cn(showLabel ? 'gap-2' : compact && 'h-8 w-8', className)}
          aria-label={t('language.label')}
        >
          <Globe className={cn(compact ? 'size-4' : 'size-5')} />
          {showLabel && (
            <span>{LOCALE_FULL_NAMES[locale] ?? localeLabels[locale]}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={setLocale}>
          {supportedLocales.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {LOCALE_FULL_NAMES[code] ?? localeLabels[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
