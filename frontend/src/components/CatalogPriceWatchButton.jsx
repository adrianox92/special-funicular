import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import api from '../lib/axios';
import { useLocale } from '../hooks/useLocale';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

function parseMaxPrice(raw) {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 99999999.99) return null;
  return Math.round(n * 100) / 100;
}

function formatEuro(value, intlLocale) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'EUR' }).format(n);
}

export default function CatalogPriceWatchButton({ catalogItemId, onMatchedOffers }) {
  const { t } = useTranslation('catalog');
  const { intlLocale } = useLocale();
  const [watch, setWatch] = useState(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancel = false;
    setReady(false);
    api
      .get('/catalog-watches', { params: { catalogItemId } })
      .then(({ data }) => {
        if (!cancel) setWatch(data?.watch || null);
      })
      .catch(() => {
        if (!cancel) setWatch(null);
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [catalogItemId]);

  const openModal = () => {
    setResult(null);
    setPrice(watch?.max_price != null ? String(watch.max_price) : '');
    setOpen(true);
  };

  const save = async () => {
    const maxPrice = parseMaxPrice(price);
    if (maxPrice == null) {
      toast.error(t('detail.watchInvalid'));
      return;
    }
    setBusy('save');
    try {
      const { data } = await api.post('/catalog-watches', { catalogItemId, maxPrice });
      setWatch(data?.watch || null);
      const matchedOfferIds = Array.isArray(data?.matchedOfferIds) ? data.matchedOfferIds : [];
      if (matchedOfferIds.length > 0) {
        setResult(null);
        setOpen(false);
        onMatchedOffers?.(matchedOfferIds);
        return;
      }
      onMatchedOffers?.([]);
      setResult({ waiting: true });
    } catch (err) {
      toast.error(err?.response?.data?.error || t('detail.watchSaveError'));
    } finally {
      setBusy(null);
    }
  };

  const stop = async () => {
    if (!watch?.id) return;
    setBusy('stop');
    try {
      await api.delete(`/catalog-watches/${watch.id}`);
      setWatch(null);
      setOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || t('detail.watchStopError'));
    } finally {
      setBusy(null);
    }
  };

  if (!ready) return null;

  const label = watch
    ? t('detail.lookingForPrice', { price: formatEuro(watch.max_price, intlLocale) })
    : t('detail.lookingFor');

  return (
    <>
      <Button type="button" variant="outline" onClick={openModal}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.watchTitle')}</DialogTitle>
            <DialogDescription>
              {result ? t('detail.watchWaiting') : t('detail.watchBody')}
            </DialogDescription>
          </DialogHeader>
          {!result && (
            <div className="space-y-2">
              <Label htmlFor="catalog-price-watch">{t('detail.watchPriceLabel')}</Label>
              <Input
                id="catalog-price-watch"
                inputMode="decimal"
                autoComplete="off"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="42"
              />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {result ? (
              <Button type="button" onClick={() => setOpen(false)}>
                {t('detail.watchClose')}
              </Button>
            ) : (
              <>
                {watch && (
                  <Button type="button" variant="ghost" disabled={busy != null} onClick={stop}>
                    {busy === 'stop' ? t('detail.watchStopping') : t('detail.watchStop')}
                  </Button>
                )}
                <Button type="button" variant="outline" disabled={busy != null} onClick={() => setOpen(false)}>
                  {t('detail.watchCancel')}
                </Button>
                <Button type="button" disabled={busy != null} onClick={save}>
                  {busy === 'save' ? t('detail.watchSaving') : t('detail.watchSave')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
