import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import PublicCatalogShell from '../components/PublicCatalogShell';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { catalogSlugify } from '../utils/catalogSlug';
import { labelMotorPosition, MOTOR_POSITION_OPTIONS } from '../data/motorPosition';
import { VEHICLE_TYPES } from '../data/vehicleTypes';
import {
  applyCatalogItemPageSeo,
  buildCatalogItemImageAlt,
  buildCatalogItemLeadParagraph,
  clearCatalogItemPageSeo,
} from '../utils/catalogItemSeo';
import { ChevronRight, Package, Star } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import CatalogBrandSelect from '../components/CatalogBrandSelect';
import CatalogTractionSelect from '../components/CatalogTractionSelect';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { dateStyle: 'medium' });
  } catch {
    return '—';
  }
}

function formatRatingAvg(avg) {
  if (avg == null || avg === '') return null;
  const n = Number(avg);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1);
}

export default function PublicCatalogDetail() {
  const { id, slug: slugParam } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myRating, setMyRating] = useState(null);
  const [myRatingLoading, setMyRatingLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestSaving, setSuggestSaving] = useState(false);
  const [suggestForm, setSuggestForm] = useState({});
  const [suggestImage, setSuggestImage] = useState(null);

  const loadItem = useCallback(async () => {
    const { data } = await api.get(`/public/catalog/items/${encodeURIComponent(id)}`);
    setItem(data);
    setSuggestForm({
      manufacturer_id: data.manufacturer_id ?? '',
      model_name: data.model_name ?? '',
      vehicle_type: data.vehicle_type ?? '',
      traction: data.traction ?? '',
      motor_position: data.motor_position ?? '',
      commercial_release_year:
        data.commercial_release_year != null ? String(data.commercial_release_year) : '',
      discontinued: Boolean(data.discontinued),
      upcoming_release: Boolean(data.upcoming_release),
    });
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadItem();
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || 'No encontrado');
          setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadItem]);

  useEffect(() => {
    if (!user || !id) {
      setMyRating(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setMyRatingLoading(true);
      try {
        const { data } = await api.get(`/catalog/items/${encodeURIComponent(id)}/rating/mine`);
        if (!cancelled) setMyRating(data.rating ?? null);
      } catch {
        if (!cancelled) setMyRating(null);
      } finally {
        if (!cancelled) setMyRatingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  useLayoutEffect(() => {
    if (!item?.id || String(item.id) !== String(id)) return;
    applyCatalogItemPageSeo(item);
    return () => {
      clearCatalogItemPageSeo();
    };
  }, [item, id]);

  const submitRating = async (value) => {
    if (!user) return;
    try {
      await api.put(`/catalog/items/${encodeURIComponent(id)}/rating`, { rating: value });
      setMyRating(value);
      const { data } = await api.get(`/public/catalog/items/${encodeURIComponent(id)}`);
      setItem(data);
      toast.success('Valoración guardada');
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo guardar la valoración');
    }
  };

  const clearRating = async () => {
    if (!user) return;
    try {
      await api.delete(`/catalog/items/${encodeURIComponent(id)}/rating`);
      setMyRating(null);
      const { data } = await api.get(`/public/catalog/items/${encodeURIComponent(id)}`);
      setItem(data);
      toast.success('Valoración eliminada');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al eliminar');
    }
  };

  const submitSuggest = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!suggestForm.manufacturer_id?.trim()) {
      toast.error('Selecciona una marca registrada.');
      return;
    }
    setSuggestSaving(true);
    try {
      const fd = new FormData();
      fd.append('manufacturer_id', suggestForm.manufacturer_id ?? '');
      fd.append('model_name', suggestForm.model_name ?? '');
      if (suggestForm.vehicle_type) fd.append('vehicle_type', suggestForm.vehicle_type);
      fd.append('traction', suggestForm.traction ?? '');
      fd.append('motor_position', suggestForm.motor_position ?? '');
      if (suggestForm.commercial_release_year) {
        fd.append('commercial_release_year', suggestForm.commercial_release_year);
      }
      fd.append('discontinued', suggestForm.discontinued ? 'true' : 'false');
      fd.append('upcoming_release', suggestForm.upcoming_release ? 'true' : 'false');
      if (suggestImage) fd.append('image', suggestImage);
      await api.post(`/catalog/items/${encodeURIComponent(id)}/change-requests`, fd);
      toast.success('Sugerencia enviada. El equipo la revisará.');
      setSuggestOpen(false);
      setSuggestImage(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al enviar');
    } finally {
      setSuggestSaving(false);
    }
  };

  if (loading) {
    return (
      <PublicCatalogShell>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Spinner className="size-8" />
        </div>
      </PublicCatalogShell>
    );
  }

  if (error || !item) {
    return (
      <PublicCatalogShell>
        <div className="max-w-2xl mx-auto px-4 py-16">
          <Alert variant="destructive">
            <AlertDescription>{error || 'Ítem no encontrado'}</AlertDescription>
          </Alert>
          <p className="mt-4 text-center">
            <Link to="/catalogo" className="text-primary underline">
              Volver al catálogo
            </Link>
          </p>
        </div>
      </PublicCatalogShell>
    );
  }

  const canonicalSlug = catalogSlugify(item.model_name || item.reference);
  if (slugParam !== canonicalSlug) {
    return <Navigate to={`/catalogo/${id}/${canonicalSlug}`} replace />;
  }

  const ratingAvgStr = formatRatingAvg(item.rating_avg);
  const ratingCount = Number(item.rating_count) || 0;
  const imageAlt = buildCatalogItemImageAlt(item);
  const leadText = buildCatalogItemLeadParagraph(item);

  return (
    <PublicCatalogShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <nav
          className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
          aria-label="Migas de pan"
        >
          <Link to="/" className="hover:text-foreground transition-colors">
            Inicio
          </Link>
          <ChevronRight className="size-4 shrink-0 opacity-60" />
          <Link to="/catalogo" className="hover:text-foreground transition-colors">
            Catálogo
          </Link>
          <ChevronRight className="size-4 shrink-0 opacity-60" />
          <Link
            to={`/catalogo?manufacturer=${encodeURIComponent(item.manufacturer)}`}
            className="text-foreground font-medium truncate max-w-[12rem] sm:max-w-none hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {item.manufacturer}
          </Link>
          <ChevronRight className="size-4 shrink-0 opacity-60 hidden sm:inline" />
          <span className="text-foreground font-medium truncate max-w-[14rem] sm:max-w-md">
            {item.model_name}
          </span>
        </nav>

        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{item.model_name}</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono">{item.reference}</span>
            <span aria-hidden>·</span>
            <span>{item.manufacturer}</span>
          </p>
          <p className="text-base text-muted-foreground max-w-3xl leading-relaxed">{leadText}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {ratingAvgStr != null ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden />
                <span className="font-medium">{ratingAvgStr}</span>
                <span>({ratingCount} valoración{ratingCount === 1 ? '' : 'es'})</span>
              </span>
            ) : (
              <span>Sin valoraciones aún</span>
            )}
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {user ? (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSuggestOpen(true)}>
                Sugerir corrección
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to="/proponer-alta-catalogo">Proponer nuevo modelo</Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to="/mis-sugerencias-catalogo">Mis sugerencias</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="text-primary underline">
                Inicia sesión
              </Link>{' '}
              para valorar, sugerir correcciones o proponer altas.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <Card className="overflow-hidden border-2 shadow-sm">
            <div className="aspect-[4/3] bg-muted flex items-center justify-center p-4 sm:p-8">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={imageAlt}
                  className="max-w-full max-h-[min(420px,50vh)] w-auto h-auto object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
                  <Package className="size-16 opacity-40" />
                  <span className="text-sm">Sin imagen en catálogo</span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-xl font-semibold leading-none tracking-tight">Detalles técnicos</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-0 divide-y divide-border">
                <DetailRow label="Referencia" value={item.reference} mono />
                <DetailRow label="Marca" value={item.manufacturer} />
                <DetailRow label="Nombre / modelo" value={item.model_name} />
                <DetailRow label="Tipo" value={item.vehicle_type || '—'} />
                <DetailRow label="Tracción" value={item.traction || '—'} />
                <DetailRow label="Posición del motor" value={labelMotorPosition(item.motor_position)} />
                <DetailRow
                  label="Año de comercialización"
                  value={item.commercial_release_year != null ? String(item.commercial_release_year) : '—'}
                />
                <DetailRow label="Descatalogado" value={item.discontinued ? 'Sí' : 'No'} />
                <DetailRow label="Próximo lanzamiento" value={item.upcoming_release ? 'Sí' : 'No'} />
                <DetailRow label="Última actualización" value={formatDate(item.updated_at)} />
              </dl>
            </CardContent>
          </Card>
        </div>

        {user && (
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold leading-none tracking-tight">Tu valoración</h2>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {myRatingLoading ? (
                <Spinner className="size-5" />
              ) : (
                <>
                  <div className="flex gap-1" role="group" aria-label="Valoración de 1 a 5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`rounded p-1 transition-colors ${
                          myRating != null && n <= myRating
                            ? 'text-amber-500'
                            : 'text-muted-foreground hover:text-amber-400'
                        }`}
                        onClick={() => submitRating(n)}
                        aria-label={`${n} estrellas`}
                      >
                        <Star
                          className={`size-8 ${myRating != null && n <= myRating ? 'fill-current' : ''}`}
                        />
                      </button>
                    ))}
                  </div>
                  {myRating != null && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearRating}>
                      Quitar mi nota
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugerir corrección</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSuggest} className="space-y-3 py-2">
            <CatalogBrandSelect
              label="Marca"
              required
              value={suggestForm.manufacturer_id ?? ''}
              onChange={(manufacturer_id) =>
                setSuggestForm((f) => ({ ...f, manufacturer_id }))
              }
            />
            <div className="space-y-2">
              <Label>Nombre / modelo</Label>
              <Input
                value={suggestForm.model_name ?? ''}
                onChange={(e) => setSuggestForm((f) => ({ ...f, model_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={suggestForm.vehicle_type || '__none__'}
                onValueChange={(v) =>
                  setSuggestForm((f) => ({ ...f, vehicle_type: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin tipo —</SelectItem>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CatalogTractionSelect
              value={suggestForm.traction ?? ''}
              onChange={(traction) => setSuggestForm((f) => ({ ...f, traction }))}
              id="suggest-catalog-traction"
            />
            <div className="space-y-2">
              <Label>Posición del motor</Label>
              <Select
                value={suggestForm.motor_position || '__none__'}
                onValueChange={(v) =>
                  setSuggestForm((f) => ({ ...f, motor_position: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin especificar —</SelectItem>
                  {MOTOR_POSITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año de comercialización</Label>
              <Input
                type="number"
                min={1900}
                max={2100}
                value={suggestForm.commercial_release_year ?? ''}
                onChange={(e) =>
                  setSuggestForm((f) => ({ ...f, commercial_release_year: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="suggest-discontinued" className="cursor-pointer">
                  Descatalogado
                </Label>
                <Switch
                  id="suggest-discontinued"
                  checked={!!suggestForm.discontinued}
                  onCheckedChange={(v) => setSuggestForm((f) => ({ ...f, discontinued: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="suggest-upcoming" className="cursor-pointer">
                  Próximo lanzamiento
                </Label>
                <Switch
                  id="suggest-upcoming"
                  checked={!!suggestForm.upcoming_release}
                  onCheckedChange={(v) => setSuggestForm((f) => ({ ...f, upcoming_release: v }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Imagen (opcional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setSuggestImage(e.target.files?.[0] || null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSuggestOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={suggestSaving}>
                {suggestSaving ? 'Enviando…' : 'Enviar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PublicCatalogShell>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(8rem,40%)_1fr] gap-1 sm:gap-4 py-3 first:pt-0">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className={`text-sm text-foreground ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
