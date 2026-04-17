import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/axios';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import { ArrowUpDown, ExternalLink, ShoppingCart } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const CONDITION_LABELS = {
  new:      { label: 'Nuevo',   variant: 'default' },
  used:     { label: 'Usado',   variant: 'secondary' },
  preorder: { label: 'Preventa', variant: 'outline' },
};

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
    <div className="h-8 w-12 shrink-0 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground border border-border">
      {initials}
    </div>
  );
}

/**
 * Detecta el identificador de la mejor oferta por moneda.
 * Devuelve un Set de ids marcados como "mejor precio".
 */
function getBestPriceIds(listings) {
  const byCurrency = new Map();
  for (const l of listings) {
    if (l.price == null) continue;
    const key = (l.currency || 'EUR').toUpperCase();
    const prev = byCurrency.get(key);
    if (!prev || l.price < prev.price) {
      byCurrency.set(key, { id: l.id, price: l.price });
    }
  }
  return new Set(Array.from(byCurrency.values()).map((v) => v.id));
}

/**
 * Sección "Dónde comprar" para la ficha pública de un ítem del catálogo.
 * Tabla comparadora ordenable por precio. No renderiza nada si no hay listados.
 */
export default function StoreListingsSection({ catalogItemId }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sortDir, setSortDir]   = useState(null); // null | 'asc' | 'desc'

  useEffect(() => {
    if (!catalogItemId) { setLoading(false); return; }
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
    return () => { cancelled = true; };
  }, [catalogItemId]);

  useEffect(() => {
    setSortDir(null);
  }, [catalogItemId]);

  const sorted = useMemo(() => {
    if (!sortDir) return listings;
    return [...listings].sort((a, b) => {
      const pa = a.price ?? Infinity;
      const pb = b.price ?? Infinity;
      return sortDir === 'asc' ? pa - pb : pb - pa;
    });
  }, [listings, sortDir]);

  const bestPriceIds = useMemo(() => getBestPriceIds(listings), [listings]);

  // Agrupar monedas presentes (para mostrar aviso si hay varias)
  const currencies = useMemo(
    () => [...new Set(listings.map((l) => (l.currency || 'EUR').toUpperCase()))],
    [listings],
  );

  if (loading) return null;
  if (listings.length === 0) return null;

  const toggleSort = () => {
    setSortDir((d) => (d == null ? 'asc' : d === 'asc' ? 'desc' : null));
  };

  const priceSortAria =
    sortDir == null ? 'Ordenar por precio (sin orden, orden del servidor)' :
    sortDir === 'asc' ? 'Ordenar por precio (actualmente de menor a mayor)' :
    'Ordenar por precio (actualmente de mayor a menor)';

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold leading-none tracking-tight flex items-center gap-2">
            <ShoppingCart className="size-4 text-muted-foreground" aria-hidden />
            Dónde comprar
          </h2>
          {currencies.length > 1 && (
            <span className="text-xs text-muted-foreground">
              Precios en varias monedas — sin conversión
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-4 pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 sm:px-6 py-2 font-medium">Tienda</th>
                <th className="px-2 py-2 font-medium hidden sm:table-cell">Descripción</th>
                <th className="px-2 py-2 font-medium">
                  <button
                    type="button"
                    onClick={toggleSort}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    aria-label={priceSortAria}
                  >
                    Precio
                    <ArrowUpDown className="size-3" aria-hidden />
                  </button>
                </th>
                <th className="px-2 py-2 font-medium hidden md:table-cell">Estado</th>
                <th className="px-4 sm:px-6 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((listing) => {
                const priceStr  = formatPrice(listing.price, listing.currency);
                const isBest    = bestPriceIds.has(listing.id);
                const condInfo  = CONDITION_LABELS[listing.condition];
                const goHref    = `${API_BASE}/store-listings/go/${listing.id}`;

                return (
                  <tr key={listing.id} className="hover:bg-muted/40 transition-colors">
                    {/* Tienda */}
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {listing.store_logo_url ? (
                          <img
                            src={listing.store_logo_url}
                            alt=""
                            className="h-8 w-12 shrink-0 rounded-md object-contain bg-muted border border-border"
                          />
                        ) : (
                          <StoreInitials name={listing.store_name} />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[10rem]">{listing.title}</p>
                          {listing.store_name && (
                            <p className="text-xs text-muted-foreground truncate">{listing.store_name}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Descripción/notas */}
                    <td className="px-2 py-3 text-xs text-muted-foreground max-w-[14rem] hidden sm:table-cell">
                      {listing.notes ? (
                        <span className="line-clamp-2">{listing.notes}</span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Precio */}
                    <td className="px-2 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        {priceStr ? (
                          <span className="font-semibold tabular-nums">{priceStr}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {isBest && priceStr && (
                          <Badge variant="default" className="text-[10px] w-fit px-1.5 py-0">
                            Mejor precio
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Condición */}
                    <td className="px-2 py-3 hidden md:table-cell">
                      {condInfo ? (
                        <Badge variant={condInfo.variant} className="text-xs">
                          {condInfo.label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">—</span>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="px-4 sm:px-6 py-3 text-right">
                      <Button size="sm" asChild>
                        <a
                          href={goHref}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          aria-label={`Ver ${listing.title} en tienda${listing.store_name ? ` ${listing.store_name}` : ''}`}
                        >
                          <ExternalLink className="size-3.5 mr-1.5" aria-hidden />
                          Ver en tienda
                        </a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
