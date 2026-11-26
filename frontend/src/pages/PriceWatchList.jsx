import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import api from '../lib/axios';
import { Button } from '../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { catalogSlugify } from '../utils/catalogSlug';
import { offerHref } from '../utils/offerHref';
import { localizePath } from '../i18n/localeUtils';
import { useLocale } from '../hooks/useLocale';

function catalogHref(locale, alert) {
  const slug = catalogSlugify(alert.model_name || alert.reference);
  return localizePath(locale, `/catalogo/${alert.catalog_item_id}/${slug}`);
}

function alertTitle(alert) {
  const name = [alert.manufacturer, alert.model_name].filter(Boolean).join(' · ');
  if (alert.reference && name) return `${alert.reference} · ${name}`;
  return alert.reference || name || alert.catalog_item_id;
}

export default function PriceWatchList() {
  const { t } = useTranslation('vehicles');
  const { t: tNav } = useTranslation('nav');
  const { locale, formatNumber } = useLocale();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/catalog-watches');
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error(error);
      toast.error(t('alerts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (amount, currency) => formatNumber(amount, {
    style: 'currency',
    currency: currency || 'EUR',
  });

  const remove = async () => {
    if (!pending) return;
    setRemoving(true);
    try {
      await api.delete(`/catalog-watches/${pending.id}`);
      setAlerts((current) => current.filter((alert) => alert.id !== pending.id));
      toast.success(t('alerts.removed'));
      setPending(null);
    } catch (error) {
      console.error(error);
      toast.error(t('alerts.removeError'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('alerts.title')}</h1>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('alerts.loading')}</p>
      ) : alerts.length === 0 ? (
        <div className="max-w-2xl space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{t('alerts.empty')}</p>
          <Button asChild>
            <Link to={localizePath(locale, '/catalogo')}>{t('alerts.browseCatalog')}</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <Link
                    to={catalogHref(locale, alert)}
                    className="font-medium hover:underline"
                  >
                    {alertTitle(alert)}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {t('alerts.maxPrice', { price: money(alert.max_price, alert.currency) })}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPending(alert)}>
                  {t('alerts.remove')}
                </Button>
              </div>

              {alert.matches?.length ? (
                <ul className="space-y-2">
                  {alert.matches.map((match) => {
                    const href = offerHref(match.short_code);
                    return (
                      <li
                        key={match.offer_id}
                        className="flex flex-col gap-2 rounded-md bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-sm">
                          <p className="font-medium">{match.shop_name}</p>
                          <p className="text-muted-foreground">
                            {money(match.price, match.currency)}
                          </p>
                        </div>
                        {href ? (
                          <div className="space-y-1">
                            <Button asChild size="sm" variant="secondary">
                              <a href={href} target="_blank" rel="sponsored noopener noreferrer">
                                {t('alerts.viewInStore')}
                              </a>
                            </Button>
                            <p className="text-xs text-muted-foreground">{tNav('bell.priceRedirect')}</p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('alerts.waiting')}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={Boolean(pending)} onOpenChange={(open) => { if (!open && !removing) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('alerts.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('alerts.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>{t('alerts.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={removing} onClick={(event) => { event.preventDefault(); remove(); }}>
              {t('alerts.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
