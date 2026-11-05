import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/axios';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ExternalLink, ShoppingCart } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function formatPrice(price, currency) {
  if (price == null) return null;
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price} ${currency || 'EUR'}`;
  }
}

function countryLabel(code, names) {
  const key = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(key)) return 'Otros';
  try {
    return names.of(key) || key;
  } catch {
    return key;
  }
}

function discountPercent(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0 || current >= previous) {
    return null;
  }
  const percent = Math.round(((previous - current) / previous) * 100);
  return percent >= 1 ? percent : null;
}

function offerHref(shortCode) {
  if (process.env.NODE_ENV === 'production') {
    return `/go/${encodeURIComponent(shortCode)}`;
  }
  const base = String(API_BASE).replace(/\/$/, '');
  return `${base}/go/${encodeURIComponent(shortCode)}`;
}

function StoreInitials({ name }) {
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="h-8 w-12 shrink-0 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground border border-border">
      {initials}
    </div>
  );
}

export function groupOffersByCountry(offers) {
  const names = new Intl.DisplayNames(['es'], { type: 'region' });
  const map = new Map();
  for (const offer of offers) {
    const code = String(offer.country_code || '').toUpperCase();
    const key = /^[A-Z]{2}$/.test(code) ? code : '??';
    if (!map.has(key)) {
      map.set(key, { code: key, label: countryLabel(key, names), offers: [] });
    }
    map.get(key).offers.push(offer);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  for (const group of groups) {
    group.offers.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }
  return groups;
}

/**
 * Dónde comprar: una fila por tienda, agrupada por país.
 * El enlace es el acortador propio. Sin ofertas en stock no se pinta.
 */
export default function StoreListingsSection({ catalogItemId }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!catalogItemId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/store-listings/catalog/${encodeURIComponent(catalogItemId)}`);
        if (!cancelled) setOffers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setOffers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [catalogItemId]);

  const groups = useMemo(() => groupOffersByCountry(offers), [offers]);

  if (loading || offers.length === 0) return null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <h2 className="text-base font-semibold leading-none tracking-tight flex items-center gap-2">
          <ShoppingCart className="size-4 text-muted-foreground" aria-hidden />
          Dónde comprar
        </h2>
        <p className="text-xs text-muted-foreground pt-2">
          Precio y disponibilidad sujetos a confirmación en tienda
        </p>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 pt-0 space-y-4">
        {groups.map((group) => (
          <section key={group.code} aria-label={group.label}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              {group.label}
            </h3>
            <ul className="divide-y divide-border border-y border-border">
              {group.offers.map((offer) => {
                const priceStr = formatPrice(offer.price, offer.currency);
                const previousValue = Number(offer.previous_price);
                const currentValue = Number(offer.price);
                const hasDrop = offer.previous_price != null
                  && offer.price != null
                  && Number.isFinite(previousValue)
                  && Number.isFinite(currentValue)
                  && previousValue > currentValue;
                const discount = hasDrop ? discountPercent(previousValue, currentValue) : null;
                const previousStr = hasDrop ? formatPrice(offer.previous_price, offer.currency) : null;
                const name = offer.shop_name || 'Tienda';
                return (
                  <li key={offer.id} className="flex items-center gap-3 py-3">
                    {offer.logo_url ? (
                      <img
                        src={offer.logo_url}
                        alt=""
                        className="h-8 w-12 shrink-0 rounded-md object-contain bg-muted border border-border"
                      />
                    ) : (
                      <StoreInitials name={name} />
                    )}
                    <p className="min-w-0 flex-1 font-medium truncate">{name}</p>
                    <span className="shrink-0 tabular-nums text-right">
                      {previousStr ? (
                        <span className="mr-2 text-sm font-normal text-muted-foreground line-through">
                          {previousStr}
                        </span>
                      ) : null}
                      {discount != null ? (
                        <Badge
                          variant="destructive"
                          className="mr-2 px-1.5 py-0 text-[10px] leading-4 shadow-none"
                        >
                          -{discount}%
                        </Badge>
                      ) : null}
                      <span className="font-semibold">{priceStr || '—'}</span>
                    </span>
                    <Button size="sm" asChild>
                      <a
                        href={offerHref(offer.short_code)}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        aria-label={`Ver ${name} en tienda`}
                      >
                        <ExternalLink className="size-3.5 mr-1.5" aria-hidden />
                        Ver en tienda
                      </a>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
