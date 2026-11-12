import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';
import { useMarketingConsent } from '../hooks/useMarketingConsent';
import { toIntlLocale } from '../i18n/localeUtils';

function formatConsentDate(iso, locale) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export default function MarketingConsentCard({ enabled = true }) {
  const { t, i18n } = useTranslation('profile');
  const intlLocale = toIntlLocale(i18n.language);
  const { consented, givenAt, withdrawnAt, loading, saving, error, save } = useMarketingConsent({
    enabled,
  });

  const stamp = consented
    ? formatConsentDate(givenAt, intlLocale)
    : formatConsentDate(withdrawnAt, intlLocale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5" aria-hidden />
          {t('marketing.title')}
        </CardTitle>
        <CardDescription>{t('marketing.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Spinner className="size-4" />
            {t('marketing.loading')}
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor="marketing-email-consent" className="font-normal leading-snug">
                {t('marketing.optInLabel')}
              </Label>
              <Switch
                id="marketing-email-consent"
                checked={consented}
                disabled={saving}
                onCheckedChange={(checked) => {
                  save(checked).catch(() => {});
                }}
              />
            </div>
            {saving && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Spinner className="size-3.5" />
                {t('marketing.saving')}
              </p>
            )}
            {stamp && (
              <p className="text-xs text-muted-foreground">
                {consented
                  ? t('marketing.savedOn', { date: stamp })
                  : t('marketing.withdrawnOn', { date: stamp })}
              </p>
            )}
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error || t('marketing.saveError')}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
