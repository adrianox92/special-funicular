import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { cachedStorageImageUrl } from '../utils/cachedStorageImageUrl';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import {
  ExternalLink,
  MousePointerClick,
  Pencil,
  PlusCircle,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import { catalogSlugify } from '../utils/catalogSlug';
import { getIntlLocale } from '../utils/formatUtils';

function formatPrice(price, currency) {
  if (price == null) return '—';
  try {
    return new Intl.NumberFormat(getIntlLocale(), {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price} ${currency || 'EUR'}`;
  }
}

const emptyListingForm = {
  catalog_item_id: '',
  catalog_item_label: '',
  title: '',
  url: '',
  price: '',
  currency: 'EUR',
  notes: '',
  active: true,
  custom_utm_campaign: '',
  condition: '',
};

// ----------------------------------------------------------------
// Sección: Perfil de tienda
// ----------------------------------------------------------------
function ProfileSection({ profile, onProfileUpdate }) {
  const { t } = useTranslation('seller');
  const [form, setForm] = useState({
    store_name:                profile?.store_name                ?? '',
    store_description:         profile?.store_description         ?? '',
    store_url:                 profile?.store_url                 ?? '',
    default_utm_source:        profile?.default_utm_source        ?? 'slotdb',
    default_utm_medium:        profile?.default_utm_medium        ?? 'catalog',
    affiliate_param_template:  profile?.affiliate_param_template  ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    setForm({
      store_name:               profile?.store_name                ?? '',
      store_description:        profile?.store_description         ?? '',
      store_url:                profile?.store_url                 ?? '',
      default_utm_source:       profile?.default_utm_source        ?? 'slotdb',
      default_utm_medium:       profile?.default_utm_medium        ?? 'catalog',
      affiliate_param_template: profile?.affiliate_param_template  ?? '',
    });
  }, [profile]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!form.store_name.trim()) {
      toast.error(t('profile.toastStoreRequired'));
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/store-listings/my/profile', {
        store_name:               form.store_name.trim(),
        store_description:        form.store_description.trim() || null,
        store_url:                form.store_url.trim() || null,
        default_utm_source:       form.default_utm_source.trim() || 'slotdb',
        default_utm_medium:       form.default_utm_medium.trim() || 'catalog',
        affiliate_param_template: form.affiliate_param_template.trim() || null,
      });
      onProfileUpdate(data);
      toast.success(t('profile.toastUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('profile.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', logoFile);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/store-listings/my/profile/logo`,
        {
          method: 'POST',
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
          body: fd,
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Error ${res.status}`);
      }
      const data = await res.json();
      onProfileUpdate(data);
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = '';
      toast.success(t('profile.toastLogoUpdated'));
    } catch (err) {
      toast.error(err.message || t('profile.toastLogoError'));
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="size-4" />
          {t('profile.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {profile?.logo_url ? (
              <img
                src={cachedStorageImageUrl(profile.logo_url)}
                alt={t('profile.logoAlt')}
                className="h-16 w-28 rounded-md object-contain bg-muted border border-border"
              />
            ) : (
              <div className="h-16 w-28 rounded-md bg-muted flex items-center justify-center text-muted-foreground border border-border">
                <Store className="size-6" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="logo-input">{t('profile.logoLabel')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="logo-input"
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!logoFile || logoUploading}
                onClick={uploadLogo}
              >
                {logoUploading ? (
                  <Spinner className="size-4" />
                ) : (
                  <Upload className="size-4 mr-1.5" />
                )}
                {t('profile.upload')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('profile.logoHint')}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="store_name">{t('profile.storeName')}</Label>
            <Input
              id="store_name"
              value={form.store_name}
              onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store_description">{t('profile.description')}</Label>
            <Input
              id="store_description"
              value={form.store_description}
              onChange={(e) => setForm((f) => ({ ...f, store_description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store_url">{t('profile.storeUrl')}</Label>
            <Input
              id="store_url"
              type="url"
              placeholder="https://..."
              value={form.store_url}
              onChange={(e) => setForm((f) => ({ ...f, store_url: e.target.value }))}
            />
          </div>

          {/* Configuración de tracking UTM/afiliados */}
          <details className="border rounded-lg p-3 space-y-3">
            <summary className="cursor-pointer text-sm font-medium select-none">
              {t('profile.trackingSummary')}
            </summary>
            <p className="text-xs text-muted-foreground">
              {t('profile.trackingLead')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="utm_source" className="text-xs">{t('profile.utmSource')}</Label>
                <Input
                  id="utm_source"
                  value={form.default_utm_source}
                  placeholder="slotdb"
                  onChange={(e) => setForm((f) => ({ ...f, default_utm_source: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="utm_medium" className="text-xs">{t('profile.utmMedium')}</Label>
                <Input
                  id="utm_medium"
                  value={form.default_utm_medium}
                  placeholder="catalog"
                  onChange={(e) => setForm((f) => ({ ...f, default_utm_medium: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="affiliate_tpl" className="text-xs">{t('profile.affiliateParam')}</Label>
              <Input
                id="affiliate_tpl"
                value={form.affiliate_param_template}
                placeholder={t('profile.affiliatePlaceholder')}
                onChange={(e) => setForm((f) => ({ ...f, affiliate_param_template: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {t('profile.affiliateHint')}
              </p>
            </div>
          </details>

          <Button type="submit" disabled={saving} size="sm">
            {saving ? <Spinner className="size-4 mr-2" /> : null}
            {t('profile.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Sección: solicitar alta como vendedor
// ----------------------------------------------------------------
function RequestAccessSection({ onCreated }) {
  const { t } = useTranslation('seller');
  const [form, setForm] = useState({ store_name: '', store_description: '', store_url: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.store_name.trim()) {
      toast.error(t('requestAccess.toastStoreRequired'));
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/store-listings/my/profile', {
        store_name: form.store_name.trim(),
        store_description: form.store_description.trim() || null,
        store_url: form.store_url.trim() || null,
      });
      onCreated(data);
      toast.success(t('requestAccess.toastSubmitted'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('requestAccess.toastError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('requestAccess.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {t('requestAccess.lead')}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="req_store_name">{t('requestAccess.storeName')}</Label>
            <Input
              id="req_store_name"
              value={form.store_name}
              onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req_store_description">{t('requestAccess.description')}</Label>
            <Input
              id="req_store_description"
              value={form.store_description}
              onChange={(e) => setForm((f) => ({ ...f, store_description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req_store_url">{t('requestAccess.storeUrl')}</Label>
            <Input
              id="req_store_url"
              type="url"
              placeholder="https://..."
              value={form.store_url}
              onChange={(e) => setForm((f) => ({ ...f, store_url: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner className="size-4 mr-2" /> : null}
            {t('requestAccess.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------
// Diálogo para buscar un ítem del catálogo
// ----------------------------------------------------------------
function CatalogItemPicker({ value, label, onChange }) {
  const { t } = useTranslation('seller');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/catalog/search?q=${encodeURIComponent(query.trim())}`);
        if (!cancelled) setResults(data?.items ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const selectItem = (item) => {
    onChange({
      id: item.id,
      label: `${item.reference} — ${item.manufacturer} ${item.model_name}`,
    });
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="space-y-2">
      <Label>{t('catalogPicker.label')}</Label>
      <div className="flex gap-2">
        <Input
          value={label || ''}
          readOnly
          placeholder={t('catalogPicker.placeholder')}
          className="flex-1 bg-muted cursor-default"
          onClick={() => setOpen(true)}
        />
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {t('catalogPicker.search')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('catalogPicker.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder={t('catalogPicker.queryPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <div className="flex justify-center py-4">
                <Spinner className="size-5" />
              </div>
            )}
            {!searching && results.length === 0 && query.trim().length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t('catalogPicker.noResults')}</p>
            )}
            {!searching && results.length > 0 && (
              <ul className="max-h-64 overflow-y-auto divide-y divide-border border rounded-md">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => selectItem(item)}
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">
                        {item.reference}
                      </span>
                      <span className="font-medium">{item.model_name}</span>
                      {item.manufacturer && (
                        <span className="text-muted-foreground ml-1">· {item.manufacturer}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('catalogPicker.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------
// Diálogo: crear / editar listado
// ----------------------------------------------------------------
function ListingDialog({ open, onOpenChange, listing, onSaved }) {
  const { t } = useTranslation('seller');
  const isEdit = Boolean(listing?.id);
  const [form, setForm] = useState(emptyListingForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        listing
          ? {
              catalog_item_id: listing.catalog_item_id ?? '',
              catalog_item_label: listing.catalog_item
                ? `${listing.catalog_item.reference} — ${listing.catalog_item.manufacturer} ${listing.catalog_item.model_name}`
                : '',
              title: listing.title ?? '',
              url: listing.url ?? '',
              price: listing.price != null ? String(listing.price) : '',
              currency: listing.currency ?? 'EUR',
              notes: listing.notes ?? '',
              active: listing.active ?? true,
              custom_utm_campaign: listing.custom_utm_campaign ?? '',
              condition: listing.condition ?? '',
            }
          : emptyListingForm,
      );
    }
  }, [open, listing]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.catalog_item_id) {
      toast.error(t('listingDialog.toastSelectCatalog'));
      return;
    }
    if (!form.title.trim()) {
      toast.error(t('listingDialog.toastTitleRequired'));
      return;
    }
    if (!form.url.trim()) {
      toast.error(t('listingDialog.toastUrlRequired'));
      return;
    }
    setSaving(true);
    try {
      const body = {
        catalog_item_id:     form.catalog_item_id,
        title:               form.title.trim(),
        url:                 form.url.trim(),
        price:               form.price !== '' ? parseFloat(form.price) : null,
        currency:            form.currency.trim().toUpperCase() || 'EUR',
        notes:               form.notes.trim() || null,
        active:              form.active,
        custom_utm_campaign: form.custom_utm_campaign?.trim() || null,
        condition:           form.condition || null,
      };
      let data;
      if (isEdit) {
        ({ data } = await api.put(`/store-listings/${listing.id}`, body));
      } else {
        ({ data } = await api.post('/store-listings', body));
      }
      onSaved(data, isEdit);
      onOpenChange(false);
      toast.success(isEdit ? t('listingDialog.toastUpdated') : t('listingDialog.toastCreated'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('listingDialog.toastSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('listingDialog.editTitle') : t('listingDialog.addTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          {!isEdit && (
            <CatalogItemPicker
              value={form.catalog_item_id}
              label={form.catalog_item_label}
              onChange={({ id, label }) =>
                setForm((f) => ({ ...f, catalog_item_id: id, catalog_item_label: label }))
              }
            />
          )}
          {isEdit && listing?.catalog_item && (
            <div className="space-y-1">
              <Label>{t('listingDialog.catalogItem')}</Label>
              <p className="text-sm rounded-md border bg-muted px-3 py-2">
                <span className="font-mono text-xs text-muted-foreground mr-2">
                  {listing.catalog_item.reference}
                </span>
                <span className="font-medium">{listing.catalog_item.model_name}</span>
                {listing.catalog_item.manufacturer && (
                  <span className="text-muted-foreground ml-1">
                    · {listing.catalog_item.manufacturer}
                  </span>
                )}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="listing_title">{t('listingDialog.title')}</Label>
            <Input
              id="listing_title"
              placeholder={t('listingDialog.titlePlaceholder')}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="listing_url">{t('listingDialog.url')}</Label>
            <Input
              id="listing_url"
              type="url"
              placeholder={t('listingDialog.urlPlaceholder')}
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="listing_price">{t('listingDialog.price')}</Label>
              <Input
                id="listing_price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="listing_currency">{t('listingDialog.currency')}</Label>
              <Input
                id="listing_currency"
                value={form.currency}
                maxLength={3}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="listing_notes">{t('listingDialog.notes')}</Label>
            <Input
              id="listing_notes"
              placeholder={t('listingDialog.notesPlaceholder')}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {/* Condición */}
          <div className="space-y-2">
            <Label htmlFor="listing_condition">{t('listingDialog.condition')}</Label>
            <select
              id="listing_condition"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            >
              <option value="">{t('listingDialog.conditionUnset')}</option>
              <option value="new">{t('listingDialog.conditionNew')}</option>
              <option value="used">{t('listingDialog.conditionUsed')}</option>
              <option value="preorder">{t('listingDialog.conditionPreorder')}</option>
            </select>
          </div>

          {/* UTM campaign personalizada */}
          <div className="space-y-2">
            <Label htmlFor="listing_utm">{t('listingDialog.utmCampaign')}</Label>
            <Input
              id="listing_utm"
              placeholder={t('listingDialog.utmPlaceholder')}
              value={form.custom_utm_campaign}
              onChange={(e) => setForm((f) => ({ ...f, custom_utm_campaign: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {t('listingDialog.utmHint')}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="listing_active" className="cursor-pointer">
              {t('listingDialog.activeLabel')}
            </Label>
            <Switch
              id="listing_active"
              checked={form.active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('listingDialog.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 mr-2" /> : null}
              {isEdit ? t('listingDialog.saveChanges') : t('listingDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------
// Tabla de listados
// ----------------------------------------------------------------
function ListingsTable({ listings, onEdit, onDelete }) {
  const { t } = useTranslation('seller');
  if (listings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {t('table.empty')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.catalogItem')}</TableHead>
            <TableHead>{t('table.title')}</TableHead>
            <TableHead className="text-right">{t('table.price')}</TableHead>
            <TableHead className="text-center">
              <MousePointerClick className="size-4 inline-block" aria-label={t('table.clicksAria')} />
            </TableHead>
            <TableHead className="text-center">{t('table.active')}</TableHead>
            <TableHead className="text-right">{t('table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="max-w-[14rem]">
                {l.catalog_item ? (
                  <Link
                    to={`/catalogo/${l.catalog_item_id}/${catalogSlugify(l.catalog_item.model_name || l.catalog_item.reference)}`}
                    className="text-sm hover:underline underline-offset-2 truncate block"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-1">
                      {l.catalog_item.reference}
                    </span>
                    {l.catalog_item.model_name}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground font-mono">{l.catalog_item_id}</span>
                )}
              </TableCell>
              <TableCell className="max-w-[12rem]">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:underline flex items-center gap-1 truncate"
                >
                  {l.title}
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                </a>
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatPrice(l.price, l.currency)}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="tabular-nums">
                  {l.click_count}
                </Badge>
              </TableCell>
              <TableCell className="text-center">
                {l.active ? (
                  <Badge variant="default" className="text-xs">{t('table.yes')}</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">{t('table.no')}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => onEdit(l)}
                    aria-label={t('table.editAria')}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(l)}
                    aria-label={t('table.deleteAria')}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ----------------------------------------------------------------
// Página principal
// ----------------------------------------------------------------
export default function SellerDashboard() {
  const { t } = useTranslation('seller');
  const { user } = useAuth();
  const [profile, setProfile] = useState(undefined);
  const [profileLoading, setProfileLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const { data } = await api.get('/store-listings/my/profile');
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const { data } = await api.get('/store-listings/my');
      setListings(Array.isArray(data) ? data : []);
    } catch {
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile?.approved) {
      loadListings();
    }
  }, [profile, loadListings]);

  const handleProfileUpdate = (updated) => setProfile(updated);
  const handleProfileCreated = (created) => {
    setProfile(created);
    window.dispatchEvent(new CustomEvent('slotdb-seller-profile-updated'));
  };

  const openCreate = () => {
    setEditingListing(null);
    setDialogOpen(true);
  };

  const openEdit = (listing) => {
    setEditingListing(listing);
    setDialogOpen(true);
  };

  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setListings((prev) =>
        prev.map((l) =>
          l.id === saved.id ? { ...saved, click_count: l.click_count, catalog_item: l.catalog_item } : l,
        ),
      );
    } else {
      loadListings();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/store-listings/${deleteTarget.id}`);
      setListings((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      toast.success(t('deleteDialog.toastDeleted'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('deleteDialog.toastError'));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertDescription>
          {t('loginRequired.prefix')}{' '}
          <Link to="/login" className="text-primary underline">
            {t('loginRequired.login')}
          </Link>{' '}
          {t('loginRequired.suffix')}
        </AlertDescription>
      </Alert>
    );
  }

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Spinner className="size-7" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Store className="size-6" />
            {t('page.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('page.subtitle')}
          </p>
        </div>
        {profile?.approved && (
          <Button onClick={openCreate}>
            <PlusCircle className="size-4 mr-2" />
            {t('page.addListing')}
          </Button>
        )}
      </div>

      {/* Sin perfil: formulario de solicitud */}
      {!profile && (
        <RequestAccessSection onCreated={handleProfileCreated} />
      )}

      {/* Perfil pendiente de aprobación o rechazado */}
      {profile && !profile.approved && (
        <Alert variant={profile.rejection_reason ? 'destructive' : 'default'}>
          <AlertDescription>
            {profile.rejection_reason ? (
              <>
                {t('pending.rejectedLead')}
                <br />
                <span className="mt-1 block text-sm">
                  {t('pending.reasonLabel')} {profile.rejection_reason}
                </span>
                <span className="mt-2 block text-sm">
                  {t('pending.rejectedFooterBefore')}
                  <a href="/politicas/seller-terms" className="underline" target="_blank" rel="noopener noreferrer">
                    {t('pending.sellerTermsLink')}
                  </a>
                  {t('pending.rejectedFooterAfter')}
                </span>
              </>
            ) : (
              <>
                {t('pending.pendingLead')}{' '}
                {t('pending.pendingDetail')}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Perfil aprobado: sección de edición de perfil */}
      {profile?.approved && (
        <ProfileSection profile={profile} onProfileUpdate={handleProfileUpdate} />
      )}

      {/* Tabla de listados (solo si aprobado) */}
      {profile?.approved && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('page.myListings')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {listingsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="size-6" />
              </div>
            ) : (
              <ListingsTable listings={listings} onEdit={openEdit} onDelete={setDeleteTarget} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Diálogo crear/editar */}
      <ListingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        listing={editingListing}
        onSaved={handleSaved}
      />

      {/* Confirmación de borrado */}
      {deleteTarget && (
        <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t('deleteDialog.description', { title: deleteTarget.title })}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                {t('deleteDialog.cancel')}
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                {deleting ? <Spinner className="size-4 mr-2" /> : null}
                {t('deleteDialog.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
