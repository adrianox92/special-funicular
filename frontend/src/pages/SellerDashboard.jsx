import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
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

function formatPrice(price, currency) {
  if (price == null) return '—';
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

const emptyListingForm = {
  catalog_item_id: '',
  catalog_item_label: '',
  title: '',
  url: '',
  price: '',
  currency: 'EUR',
  notes: '',
  active: true,
};

// ----------------------------------------------------------------
// Sección: Perfil de tienda
// ----------------------------------------------------------------
function ProfileSection({ profile, onProfileUpdate }) {
  const [form, setForm] = useState({
    store_name: profile?.store_name ?? '',
    store_description: profile?.store_description ?? '',
    store_url: profile?.store_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    setForm({
      store_name: profile?.store_name ?? '',
      store_description: profile?.store_description ?? '',
      store_url: profile?.store_url ?? '',
    });
  }, [profile]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!form.store_name.trim()) {
      toast.error('El nombre de la tienda es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/store-listings/my/profile', {
        store_name: form.store_name.trim(),
        store_description: form.store_description.trim() || null,
        store_url: form.store_url.trim() || null,
      });
      onProfileUpdate(data);
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar el perfil');
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
      toast.success('Logo actualizado');
    } catch (err) {
      toast.error(err.message || 'Error al subir el logo');
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="size-4" />
          Perfil de tienda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo */}
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {profile?.logo_url ? (
              <img
                src={profile.logo_url}
                alt="Logo de la tienda"
                className="h-16 w-28 rounded-md object-contain bg-muted border border-border"
              />
            ) : (
              <div className="h-16 w-28 rounded-md bg-muted flex items-center justify-center text-muted-foreground border border-border">
                <Store className="size-6" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="logo-input">Logo de la tienda</Label>
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
                Subir
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG o WebP. Máx. 4 MB.</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="store_name">Nombre de la tienda *</Label>
            <Input
              id="store_name"
              value={form.store_name}
              onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store_description">Descripción (opcional)</Label>
            <Input
              id="store_description"
              value={form.store_description}
              onChange={(e) => setForm((f) => ({ ...f, store_description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store_url">Enlace a la tienda (opcional)</Label>
            <Input
              id="store_url"
              type="url"
              placeholder="https://..."
              value={form.store_url}
              onChange={(e) => setForm((f) => ({ ...f, store_url: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={saving} size="sm">
            {saving ? <Spinner className="size-4 mr-2" /> : null}
            Guardar perfil
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
  const [form, setForm] = useState({ store_name: '', store_description: '', store_url: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.store_name.trim()) {
      toast.error('El nombre de la tienda es obligatorio');
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
      toast.success('Solicitud enviada. El equipo la revisará pronto.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Solicitar acceso como vendedor</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Para poder añadir productos del catálogo a la venta, necesitas que el equipo apruebe tu tienda.
          Rellena el formulario y recibirás confirmación por correo.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="req_store_name">Nombre de la tienda *</Label>
            <Input
              id="req_store_name"
              value={form.store_name}
              onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req_store_description">Descripción (opcional)</Label>
            <Input
              id="req_store_description"
              value={form.store_description}
              onChange={(e) => setForm((f) => ({ ...f, store_description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req_store_url">Web de la tienda (opcional)</Label>
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
            Enviar solicitud
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
      <Label>Ítem del catálogo *</Label>
      <div className="flex gap-2">
        <Input
          value={label || ''}
          readOnly
          placeholder="Selecciona un ítem del catálogo…"
          className="flex-1 bg-muted cursor-default"
          onClick={() => setOpen(true)}
        />
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Buscar
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buscar ítem del catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Referencia, marca o modelo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <div className="flex justify-center py-4">
                <Spinner className="size-5" />
              </div>
            )}
            {!searching && results.length === 0 && query.trim().length >= 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin resultados</p>
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
              Cancelar
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
            }
          : emptyListingForm,
      );
    }
  }, [open, listing]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.catalog_item_id) {
      toast.error('Selecciona un ítem del catálogo');
      return;
    }
    if (!form.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    if (!form.url.trim()) {
      toast.error('La URL es obligatoria');
      return;
    }
    setSaving(true);
    try {
      const body = {
        catalog_item_id: form.catalog_item_id,
        title: form.title.trim(),
        url: form.url.trim(),
        price: form.price !== '' ? parseFloat(form.price) : null,
        currency: form.currency.trim().toUpperCase() || 'EUR',
        notes: form.notes.trim() || null,
        active: form.active,
      };
      let data;
      if (isEdit) {
        ({ data } = await api.put(`/store-listings/${listing.id}`, body));
      } else {
        ({ data } = await api.post('/store-listings', body));
      }
      onSaved(data, isEdit);
      onOpenChange(false);
      toast.success(isEdit ? 'Listado actualizado' : 'Listado creado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar listado' : 'Añadir listado'}</DialogTitle>
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
              <Label>Ítem del catálogo</Label>
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
            <Label htmlFor="listing_title">Título *</Label>
            <Input
              id="listing_title"
              placeholder="Ej: Scalextric Ford GT Race 1:32"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="listing_url">Enlace al producto *</Label>
            <Input
              id="listing_url"
              type="url"
              placeholder="https://tienda.com/producto"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="listing_price">Precio (opcional)</Label>
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
              <Label htmlFor="listing_currency">Moneda</Label>
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
            <Label htmlFor="listing_notes">Notas (opcional)</Label>
            <Input
              id="listing_notes"
              placeholder="Ej: Envío gratuito, stock limitado…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="listing_active" className="cursor-pointer">
              Listado activo (visible en el catálogo)
            </Label>
            <Switch
              id="listing_active"
              checked={form.active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="size-4 mr-2" /> : null}
              {isEdit ? 'Guardar cambios' : 'Crear listado'}
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
  if (listings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Aún no tienes listados. Haz clic en «Añadir listado» para empezar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ítem del catálogo</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-center">
              <MousePointerClick className="size-4 inline-block" aria-label="Clics" />
            </TableHead>
            <TableHead className="text-center">Activo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
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
                  <Badge variant="default" className="text-xs">Sí</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">No</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => onEdit(l)}
                    aria-label="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(l)}
                    aria-label="Eliminar"
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
  const handleProfileCreated = (created) => setProfile(created);

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
      toast.success('Listado eliminado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!user) {
    return (
      <Alert>
        <AlertDescription>
          Debes{' '}
          <Link to="/login" className="text-primary underline">
            iniciar sesión
          </Link>{' '}
          para acceder al panel de vendedor.
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
            Panel de vendedor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los productos de tu tienda en el catálogo.
          </p>
        </div>
        {profile?.approved && (
          <Button onClick={openCreate}>
            <PlusCircle className="size-4 mr-2" />
            Añadir listado
          </Button>
        )}
      </div>

      {/* Sin perfil: formulario de solicitud */}
      {!profile && (
        <RequestAccessSection onCreated={handleProfileCreated} />
      )}

      {/* Perfil pendiente de aprobación */}
      {profile && !profile.approved && (
        <Alert>
          <AlertDescription>
            Tu solicitud de alta como vendedor está <strong>pendiente de aprobación</strong>.
            Recibirás acceso completo una vez que el equipo la revise.
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
            <CardTitle className="text-base">Mis listados</CardTitle>
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
              <DialogTitle>Eliminar listado</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              ¿Seguro que quieres eliminar «{deleteTarget.title}»? Esta acción no se puede deshacer.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                {deleting ? <Spinner className="size-4 mr-2" /> : null}
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
