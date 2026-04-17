import React, { useEffect, useState } from 'react';
import api from '../lib/axios';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import { ExternalLink, ShoppingCart } from 'lucide-react';

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

function StoreInitials({ name }) {
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="h-10 w-14 shrink-0 rounded-md bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground border border-border">
      {initials}
    </div>
  );
}

function generateSessionId() {
  try {
    const stored = sessionStorage.getItem('slotdb_session_id');
    if (stored) return stored;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('slotdb_session_id', id);
    return id;
  } catch {
    return null;
  }
}

async function recordClick(listingId) {
  try {
    await api.post(`/store-listings/${listingId}/click`, {
      session_id: generateSessionId(),
    });
  } catch {
    // El tracking de clics no debe bloquear la navegación
  }
}

/**
 * Sección "Dónde comprar" para la ficha pública de un ítem del catálogo.
 * Si no hay listados activos, no renderiza nada.
 */
export default function StoreListingsSection({ catalogItemId }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!catalogItemId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/store-listings/catalog/${encodeURIComponent(catalogItemId)}`);
        if (!cancelled) setListings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogItemId]);

  if (loading) return null;
  if (listings.length === 0) return null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <h2 className="text-base font-semibold leading-none tracking-tight flex items-center gap-2">
          <ShoppingCart className="size-4 text-muted-foreground" aria-hidden />
          Dónde comprar
        </h2>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner className="size-5" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {listings.map((listing) => {
              const priceStr = formatPrice(listing.price, listing.currency);
              return (
                <li key={listing.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {listing.store_logo_url ? (
                    <img
                      src={listing.store_logo_url}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded-md object-contain bg-muted border border-border"
                    />
                  ) : (
                    <StoreInitials name={listing.store_name} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{listing.title}</p>
                    {listing.store_name && (
                      <p className="text-xs text-muted-foreground truncate">{listing.store_name}</p>
                    )}
                    {listing.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{listing.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {priceStr && (
                      <Badge variant="secondary" className="text-sm font-semibold whitespace-nowrap">
                        {priceStr}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      asChild
                      onClick={() => recordClick(listing.id)}
                    >
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Ver ${listing.title} en tienda${listing.store_name ? ` ${listing.store_name}` : ''}`}
                      >
                        <ExternalLink className="size-3.5 mr-1.5" aria-hidden />
                        Ver en tienda
                      </a>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
