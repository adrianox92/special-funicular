import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import PublicCatalogShell from '../components/PublicCatalogShell';
import CatalogThirdPartyNotice from '../components/CatalogThirdPartyNotice';
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
  clearCatalogItemPageSeo,
} from '../utils/catalogItemSeo';
import { ChevronRight, ExternalLink, Package, Star, X } from 'lucide-react';
import StoreListingsSection from '../components/StoreListingsSection';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import CatalogBrandSelect from '../components/CatalogBrandSelect';
import CatalogTractionSelect from '../components/CatalogTractionSelect';
import CatalogPrevNext from '../components/CatalogPrevNext';
import { useLocale } from '../hooks/useLocale';
import { localizePath } from '../i18n/localeUtils';
import { buildLoginPath, withIntent } from '../utils/authReturnUrl';

function readItemBootstrap(expectedId) {
  if (typeof window === 'undefined' || !expectedId) return null;
  const boot = window.__PUBLIC_CATALOG_BOOTSTRAP__;
  if (boot?.kind !== 'item' || !boot.item || String(boot.item.id) !== String(expectedId)) {
    return null;
  }
  return boot.item;
}

function formatRatingAvg(avg) {
  if (avg == null || avg === '') return null;
  const n = Number(avg);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1);
}

export default function PublicCatalogDetail({ catalogItemId, catalogSlug } = {}) {
  const params = useParams();
  const id = catalogItemId ?? params.id;
  const slugParam = catalogSlug ?? params.slug;
  const { user } = useAuth();
  const { t } = useTranslation('catalog');
  const { locale, formatDate } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const garageCtaRef = useRef(null);
  const ratingCardRef = useRef(null);
  const [item, setItem] = useState(() => readItemBootstrap(catalogItemId ?? params.id));
  const [loading, setLoading] = useState(() => item == null);
  const [error, setError] = useState(null);
  const [myRating, setMyRating] = useState(null);
  const [myRatingLoading, setMyRatingLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestSaving, setSuggestSaving] = useState(false);
  const [suggestForm, setSuggestForm] = useState({});
  const [suggestImage, setSuggestImage] = useState(null);
  const [catalogImageZoomOpen, setCatalogImageZoomOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__PUBLIC_CATALOG_BOOTSTRAP__?.kind === 'item') {
      window.__PUBLIC_CATALOG_BOOTSTRAP__ = undefined;
    }
  }, []);

  const closeCatalogImageZoom = useCallback(() => {
    setCatalogImageZoomOpen(false);
  }, []);

  useEffect(() => {
    if (!catalogImageZoomOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeCatalogImageZoom();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [catalogImageZoomOpen, closeCatalogImageZoom]);

  useEffect(() => {
    setCatalogImageZoomOpen(false);
  }, [id]);

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
      dorsal: data.dorsal ?? '',
      limited_edition: Boolean(data.limited_edition),
      limited_edition_total:
        data.limited_edition_total != null ? String(data.limited_edition_total) : '',
      discontinued: Boolean(data.discontinued),
      upcoming_release: Boolean(data.upcoming_release),
      real_race_results_url: data.real_race_results_url != null ? String(data.real_race_results_url) : '',
      real_race_photos_url: data.real_race_photos_url != null ? String(data.real_race_photos_url) : '',
    });
  }, [id]);

  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = itemRef.current;
      if (!current || String(current.id) !== String(id)) {
        setLoading(true);
      }
      setError(null);
      try {
        await loadItem();
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || t('detail.loadError'));
          setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, loadItem, t]);

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
  }, [item, id, locale]);

  const catalogListHref = localizePath(locale, '/catalogo');
  const homeHref = locale === 'es' ? '/' : `/${locale}`;

  const goAuth = (intent) =>
    buildLoginPath({
      register: true,
      returnUrl: withIntent(location.pathname, location.search, intent),
    });
  const postAuthIntent = new URLSearchParams(location.search).get('intent');
  const garageHighlight =
    postAuthIntent === 'addToGarage' ? ' ring-2 ring-primary ring-offset-2 ring-offset-background' : '';

  useEffect(() => {
    const intent = new URLSearchParams(location.search).get('intent');
    if (!user || !intent) return;
    const target = intent === 'rate' ? ratingCardRef.current : garageCtaRef.current;
    if (target?.scrollIntoView) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [user, location.search, item]);

  const submitRating = async (value) => {
    if (!user) return;
    try {
      await api.put(`/catalog/items/${encodeURIComponent(id)}/rating`, { rating: value });
      setMyRating(value);
      const { data } = await api.get(`/public/catalog/items/${encodeURIComponent(id)}`);
      setItem(data);
      toast.success(t('detail.ratingSaved'));
    } catch (e) {
      toast.error(e.response?.data?.error || t('detail.ratingSaveError'));
    }
  };

  const clearRating = async () => {
    if (!user) return;
    try {
      await api.delete(`/catalog/items/${encodeURIComponent(id)}/rating`);
      setMyRating(null);
      const { data } = await api.get(`/public/catalog/items/${encodeURIComponent(id)}`);
      setItem(data);
      toast.success(t('detail.ratingCleared'));
    } catch (e) {
      toast.error(e.response?.data?.error || t('detail.ratingClearError'));
    }
  };

  const submitSuggest = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!suggestForm.manufacturer_id?.trim()) {
      toast.error(t('detail.suggestBrandRequired'));
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
      fd.append('dorsal', suggestForm.dorsal ?? '');
      fd.append('limited_edition', suggestForm.limited_edition ? 'true' : 'false');
      fd.append(
        'limited_edition_total',
        suggestForm.limited_edition && String(suggestForm.limited_edition_total ?? '').trim() !== ''
          ? String(suggestForm.limited_edition_total).trim()
          : '',
      );
      fd.append('real_race_results_url', suggestForm.real_race_results_url?.trim() ?? '');
      fd.append('real_race_photos_url', suggestForm.real_race_photos_url?.trim() ?? '');
      if (suggestImage) fd.append('image', suggestImage);
      await api.post(`/catalog/items/${encodeURIComponent(id)}/change-requests`, fd);
      toast.success(t('detail.suggestSent'));
      setSuggestOpen(false);
      setSuggestImage(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || t('detail.suggestSendError'));
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
            <AlertDescription>{error || t('detail.notFound')}</AlertDescription>
          </Alert>
          <p className="mt-4 text-center">
            <Link to={localizePath(locale, '/catalogo')} className="text-primary underline">
              {t('detail.backToCatalog')}
            </Link>
          </p>
        </div>
      </PublicCatalogShell>
    );
  }

  const canonicalSlug = catalogSlugify(item.model_name || item.reference);
  if (slugParam !== canonicalSlug) {
    return <Navigate to={localizePath(locale, `/catalogo/${id}/${canonicalSlug}`)} replace />;
  }

  const ratingAvgStr = formatRatingAvg(item.rating_avg);
  const ratingCount = Number(item.rating_count) || 0;
  const imageAlt = buildCatalogItemImageAlt(item, locale);
  const registeredUserCount = Number(item.registered_user_count) || 0;
  const collectionBlurb =
    registeredUserCount === 0
      ? t('detail.collectionNone')
      : registeredUserCount === 1
        ? t('detail.collectionOne')
        : t('detail.collectionMany', { count: registeredUserCount });

  const publicRaceResultsUrl =
    item.real_race_results_url != null && String(item.real_race_results_url).trim() !== ''
      ? String(item.real_race_results_url).trim()
      : null;
  const publicRacePhotosUrl =
    item.real_race_photos_url != null && String(item.real_race_photos_url).trim() !== ''
      ? String(item.real_race_photos_url).trim()
      : null;

  return (
    <PublicCatalogShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <nav
          className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
          aria-label={t('detail.breadcrumbAria')}
        >
          <Link to={homeHref} className="hover:text-foreground transition-colors">
            {t('detail.home')}
          </Link>
          <ChevronRight className="size-4 shrink-0 opacity-60" />
          <Link to={catalogListHref} className="hover:text-foreground transition-colors">
            {t('detail.catalog')}
          </Link>
          <ChevronRight className="size-4 shrink-0 opacity-60" />
          <Link
            to={`${catalogListHref}?manufacturer=${encodeURIComponent(item.manufacturer)}`}
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
            {item.dorsal != null && String(item.dorsal).trim() !== '' && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {t('detail.dorsal')} <span className="text-foreground font-medium tabular-nums">{String(item.dorsal).trim()}</span>
                </span>
              </>
            )}
          </p>
          <CatalogPrevNext neighbors={item.neighbors} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {ratingAvgStr != null ? (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden />
                <span className="font-medium">{ratingAvgStr}</span>
                <span>{t('detail.ratingCount', { count: ratingCount })}</span>
              </span>
            ) : (
              <span>{t('detail.noRatings')}</span>
            )}
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {user ? (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSuggestOpen(true)}>
                {t('detail.suggestCorrection')}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link to="/proponer-alta-catalogo">{t('detail.proposeNew')}</Link>
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link to="/mis-sugerencias-catalogo">{t('detail.mySuggestions')}</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link to={goAuth()} className="text-primary underline">
                {t('detail.guestLoginLink')}
              </Link>{' '}
              {t('detail.guestHint')}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <Card className="overflow-visible border-2 shadow-sm">
            {item.image_url ? (
              <div
                className="relative rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                tabIndex={0}
                onMouseEnter={() => setCatalogImageZoomOpen(true)}
                onMouseLeave={() => setCatalogImageZoomOpen(false)}
                onFocus={() => setCatalogImageZoomOpen(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setCatalogImageZoomOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeCatalogImageZoom();
                    e.currentTarget.blur();
                  }
                }}
              >
                <div className="aspect-[4/3] bg-muted flex items-center justify-center p-4 sm:p-8 rounded-xl overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={imageAlt}
                    className="max-w-full max-h-[min(420px,50vh)] w-auto h-auto object-contain cursor-zoom-in"
                  />
                </div>
                {catalogImageZoomOpen ? (
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('detail.imageZoomAria')}
                    className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8 bg-background/70 backdrop-blur-sm animate-in fade-in-0 duration-200"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) closeCatalogImageZoom();
                    }}
                  >
                    <div className="relative max-h-[min(90vh,900px)] max-w-[min(96vw,56rem)]">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="absolute -right-2 -top-2 z-10 size-10 rounded-full border-2 border-border shadow-md sm:-right-3 sm:-top-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeCatalogImageZoom();
                        }}
                        aria-label={t('detail.closeZoom')}
                      >
                        <X className="size-5" aria-hidden />
                      </Button>
                      <img
                        src={item.image_url}
                        alt=""
                        className="max-h-[min(90vh,900px)] max-w-[min(96vw,56rem)] w-auto object-contain rounded-lg border-2 border-border shadow-2xl bg-card"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="aspect-[4/3] bg-muted flex items-center justify-center p-4 sm:p-8 rounded-xl overflow-hidden">
                <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
                  <Package className="size-16 opacity-40" />
                  <span className="text-sm">{t('detail.noImage')}</span>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-xl font-semibold leading-none tracking-tight">{t('detail.specsTitle')}</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-0 divide-y divide-border">
                <DetailRow label={t('detail.fieldReference')} value={item.reference} mono />
                <DetailRow label={t('detail.fieldBrand')} value={item.manufacturer} />
                <DetailRow label={t('detail.fieldName')} value={item.model_name} />
                <DetailRow label={t('detail.fieldType')} value={item.vehicle_type || '—'} />
                <DetailRow label={t('detail.fieldTraction')} value={item.traction || '—'} />
                <DetailRow label={t('detail.fieldMotor')} value={labelMotorPosition(item.motor_position)} />
                <DetailRow
                  label={t('detail.fieldYear')}
                  value={item.commercial_release_year != null ? String(item.commercial_release_year) : '—'}
                />
                <DetailRow
                  label={t('detail.fieldDorsal')}
                  value={
                    item.dorsal != null && String(item.dorsal).trim() !== ''
                      ? String(item.dorsal).trim()
                      : '—'
                  }
                />
                <DetailRow label={t('detail.fieldLimited')} value={item.limited_edition ? t('detail.yes') : t('detail.no')} />
                {item.limited_edition && item.limited_edition_total != null && (
                  <DetailRow
                    label={t('detail.fieldLimitedTotal')}
                    value={String(item.limited_edition_total)}
                  />
                )}
                <DetailRow label={t('detail.fieldDiscontinued')} value={item.discontinued ? t('detail.yes') : t('detail.no')} />
                <DetailRow label={t('detail.fieldUpcoming')} value={item.upcoming_release ? t('detail.yes') : t('detail.no')} />
                <DetailRow
                  label={t('detail.fieldUpdated')}
                  value={item.updated_at ? formatDate(item.updated_at, { dateStyle: 'medium' }) : '—'}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        {(publicRaceResultsUrl || publicRacePhotosUrl) && (
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-xl font-semibold leading-none tracking-tight">{t('detail.realRacing')}</h2>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {publicRaceResultsUrl && (
                <a
                  href={publicRaceResultsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  {t('detail.raceResults')}
                </a>
              )}
              {publicRacePhotosUrl && (
                <a
                  href={publicRacePhotosUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  {t('detail.racePhotos')}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        <Card ref={ratingCardRef} id="catalog-rating">
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold leading-none tracking-tight">{t('detail.yourRating')}</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {user && myRatingLoading ? (
              <Spinner className="size-5" />
            ) : (
              <>
                <div className="flex gap-1" role="group" aria-label={t('detail.ratingGroupAria')}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rounded p-1 transition-colors ${
                        myRating != null && n <= myRating
                          ? 'text-amber-500'
                          : 'text-muted-foreground hover:text-amber-400'
                      }`}
                      onClick={() => {
                        if (!user) {
                          navigate(goAuth('rate'));
                          return;
                        }
                        submitRating(n);
                      }}
                      aria-label={t('detail.starsAria', { count: n })}
                    >
                      <Star
                        className={`size-8 ${myRating != null && n <= myRating ? 'fill-current' : ''}`}
                      />
                    </button>
                  ))}
                </div>
                {user && myRating != null && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearRating}>
                    {t('detail.clearRating')}
                  </Button>
                )}
                {!user && (
                  <p className="text-sm text-muted-foreground w-full">{t('guest.rateRedirectHint')}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {!user ? (
          <Card
            ref={garageCtaRef}
            id="catalog-add-to-garage"
            className={`border-primary/40 bg-primary/5 shadow-sm${garageHighlight}`}
          >
            <CardHeader className="pb-2">
              <h2 className="text-xl font-semibold leading-none tracking-tight">{t('guest.addTitle')}</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{t('guest.addBody')}</p>
              <Button asChild>
                <Link to={goAuth('addToGarage')}>{t('guest.addCta')}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card
            ref={garageCtaRef}
            id="catalog-add-to-garage"
            className={`border-primary/30 shadow-sm${garageHighlight}`}
          >
            <CardHeader className="pb-2">
              <h2 className="text-xl font-semibold leading-none tracking-tight">{t('detail.addToGarage')}</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{t('detail.addToGarageHint')}</p>
              <Button asChild>
                <Link to={`/vehicles/new?catalogItemId=${encodeURIComponent(item.id)}`}>
                  {t('detail.addToGarage')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
            <h2 className="text-base font-semibold leading-none tracking-tight">{t('detail.collections')}</h2>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
            <p className="text-sm text-muted-foreground leading-relaxed">{collectionBlurb}</p>
          </CardContent>
        </Card>
        <StoreListingsSection catalogItemId={item.id} />
        <CatalogThirdPartyNotice />

        
      </div>

      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('detail.suggestTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitSuggest} className="space-y-3 py-2">
            <CatalogBrandSelect
              label={t('detail.fieldBrand')}
              required
              value={suggestForm.manufacturer_id ?? ''}
              onChange={(manufacturer_id) =>
                setSuggestForm((f) => ({ ...f, manufacturer_id }))
              }
            />
            <div className="space-y-2">
              <Label>{t('detail.fieldName')}</Label>
              <Input
                value={suggestForm.model_name ?? ''}
                onChange={(e) => setSuggestForm((f) => ({ ...f, model_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('detail.fieldType')}</Label>
              <Select
                value={suggestForm.vehicle_type || '__none__'}
                onValueChange={(v) =>
                  setSuggestForm((f) => ({ ...f, vehicle_type: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('detail.optional')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('detail.noType')}</SelectItem>
                  {VEHICLE_TYPES.map((typeName) => (
                    <SelectItem key={typeName} value={typeName}>
                      {typeName}
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
              <Label>{t('detail.fieldMotor')}</Label>
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
                  <SelectItem value="__none__">{t('detail.unspecified')}</SelectItem>
                  {MOTOR_POSITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('detail.fieldYear')}</Label>
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
            <div className="space-y-2">
              <Label>{t('detail.fieldDorsal')}</Label>
              <Input
                value={suggestForm.dorsal ?? ''}
                onChange={(e) => setSuggestForm((f) => ({ ...f, dorsal: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor="suggest-limited" className="cursor-pointer">
                {t('detail.fieldLimited')}
              </Label>
              <Switch
                id="suggest-limited"
                checked={!!suggestForm.limited_edition}
                onCheckedChange={(v) =>
                  setSuggestForm((f) => ({
                    ...f,
                    limited_edition: v,
                    limited_edition_total: v ? f.limited_edition_total : '',
                  }))
                }
              />
            </div>
            {suggestForm.limited_edition && (
              <div className="space-y-2">
                <Label>{t('detail.limitedTotalUnits')}</Label>
                <Input
                  type="number"
                  min={1}
                  value={suggestForm.limited_edition_total ?? ''}
                  onChange={(e) =>
                    setSuggestForm((f) => ({ ...f, limited_edition_total: e.target.value }))
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('detail.raceResultsUrl')}</Label>
              <Input
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={suggestForm.real_race_results_url ?? ''}
                onChange={(e) =>
                  setSuggestForm((f) => ({ ...f, real_race_results_url: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('detail.racePhotosUrl')}</Label>
              <Input
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={suggestForm.real_race_photos_url ?? ''}
                onChange={(e) =>
                  setSuggestForm((f) => ({ ...f, real_race_photos_url: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="suggest-discontinued" className="cursor-pointer">
                  {t('detail.fieldDiscontinued')}
                </Label>
                <Switch
                  id="suggest-discontinued"
                  checked={!!suggestForm.discontinued}
                  onCheckedChange={(v) => setSuggestForm((f) => ({ ...f, discontinued: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="suggest-upcoming" className="cursor-pointer">
                  {t('detail.fieldUpcoming')}
                </Label>
                <Switch
                  id="suggest-upcoming"
                  checked={!!suggestForm.upcoming_release}
                  onCheckedChange={(v) => setSuggestForm((f) => ({ ...f, upcoming_release: v }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('detail.optionalImage')}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setSuggestImage(e.target.files?.[0] || null)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSuggestOpen(false)}>
                {t('detail.cancel')}
              </Button>
              <Button type="submit" disabled={suggestSaving}>
                {suggestSaving ? t('detail.sending') : t('detail.send')}
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
