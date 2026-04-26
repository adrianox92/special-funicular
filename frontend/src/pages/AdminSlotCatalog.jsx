import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { supabase } from '../lib/supabase';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, ExternalLink, LayoutDashboard, Upload, GitPullRequest, PlusCircle, Tag, Store, MousePointerClick, CheckCircle2, XCircle } from 'lucide-react';
import { catalogSlugify } from '../utils/catalogSlug';
import CatalogBrandSelect from '../components/CatalogBrandSelect';
import CatalogTractionSelect from '../components/CatalogTractionSelect';
import { Switch } from '../components/ui/switch';
import { VEHICLE_TYPES } from '../data/vehicleTypes';
import { MOTOR_POSITION_OPTIONS, labelMotorPosition } from '../data/motorPosition';

const emptyItem = {
  reference: '',
  manufacturer_id: '',
  model_name: '',
  vehicle_type: '',
  traction: '',
  motor_position: '',
  commercial_release_year: '',
  discontinued: false,
  upcoming_release: false,
};

/** Parámetro `missing` en GET /catalog/items (huecos alineados con el dashboard). */
const CATALOG_ITEMS_MISSING = {
  withoutImage: 'image',
  withoutVehicleType: 'vehicle_type',
  withoutTraction: 'traction',
  withoutMotor: 'motor',
  withoutYear: 'year',
};

const CATALOG_MISSING_FILTER_LABELS = {
  '': 'Sin filtrar por huecos',
  image: 'Solo sin imagen',
  vehicle_type: 'Solo sin tipo',
  traction: 'Solo sin tracción',
  motor: 'Solo sin motor',
  year: 'Solo sin año de comercialización',
};

const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

/**
 * POST /catalog/import (NDJSON). onProgress(current, total) tras cada fila procesada.
 */
async function runCatalogImportStream(file, duplicateMode, onProgress) {
  const url = `${apiBase}/catalog/import?duplicateMode=${encodeURIComponent(duplicateMode)}`;

  const fetchOnce = (token) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
  };

  let { data: { session } } = await supabase.auth.getSession();
  let response = await fetchOnce(session?.access_token);
  if (response.status === 401) {
    await supabase.auth.refreshSession();
    ({ data: { session } } = await supabase.auth.getSession());
    response = await fetchOnce(session?.access_token);
  }

  if (!response.ok) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await response.json().catch(() => ({}));
      throw new Error(j.error || `Error ${response.status}`);
    }
    const text = await response.text();
    throw new Error(text || `Error ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('El navegador no permite leer el progreso de la importación.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let completePayload = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      let msg;
      try {
        msg = JSON.parse(t);
      } catch {
        continue;
      }
      if (msg.type === 'progress' && onProgress) {
        onProgress(msg.current ?? 0, msg.total ?? 0);
      }
      if (msg.type === 'complete') {
        const { type, ...rest } = msg;
        void type;
        completePayload = rest;
      }
      if (msg.type === 'error') {
        throw new Error(msg.message || 'Error en la importación');
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      const msg = JSON.parse(tail);
      if (msg.type === 'complete') {
        const { type, ...rest } = msg;
        void type;
        completePayload = rest;
      }
      if (msg.type === 'error') throw new Error(msg.message || 'Error en la importación');
    } catch (e) {
      if (e instanceof SyntaxError) {
        /* línea incompleta al cortar el stream */
      } else {
        throw e;
      }
    }
  }

  if (!completePayload) {
    throw new Error('Respuesta de importación incompleta.');
  }
  return completePayload;
}

function formatCatalogDiffValue(field, value) {
  if (value == null || value === '' || value === '—') return '—';
  if (field === 'motor_position') return labelMotorPosition(value) || String(value);
  return String(value);
}

function AdminSlotCatalog() {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [tab, setTab] = useState('dashboard');

  const [catalogStats, setCatalogStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refFilter, setRefFilter] = useState('');
  const [mfgBrandId, setMfgBrandId] = useState('');
  /** Filtro por hueco de datos (pestaña Ítems); vacío = sin filtro. */
  const [itemsMissingFilter, setItemsMissingFilter] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [imageFile, setImageFile] = useState(null);
  /** URL guardada en servidor al editar (solo lectura en el formulario). */
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  /** Vista previa de archivo nuevo elegido (object URL). */
  const [newImageObjectUrl, setNewImageObjectUrl] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setNewImageObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setNewImageObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const [deleteId, setDeleteId] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  const [chgReq, setChgReq] = useState([]);
  const [insReq, setInsReq] = useState([]);
  const [queuesLoading, setQueuesLoading] = useState(false);

  // Tiendas
  const [sellers, setSellers] = useState([]);
  const [sellersLoading, setSellersLoading] = useState(false);
  const [sellersFetchError, setSellersFetchError] = useState(null);
  const [clickStats, setClickStats] = useState([]);
  const [clickStatsLoading, setClickStatsLoading] = useState(false);
  const [clickStatsDays, setClickStatsDays] = useState(30);
  const [sellerApproving, setSellerApproving] = useState(null);
  const [createSellerOpen, setCreateSellerOpen] = useState(false);
  const [createSellerForm, setCreateSellerForm] = useState({ email: '', store_name: '', store_description: '', store_url: '' });
  const [createSellerSaving, setCreateSellerSaving] = useState(false);
  // Diálogo de moderación (rechazo con motivo + notas admin)
  const [moderationDialogOpen, setModerationDialogOpen] = useState(false);
  const [moderationTarget, setModerationTarget] = useState(null); // { userId, action: 'approve'|'reject' }
  const [moderationForm, setModerationForm] = useState({ rejection_reason: '', admin_notes: '' });
  // Políticas
  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [policyEditSlug, setPolicyEditSlug] = useState('');
  const [policyForm, setPolicyForm] = useState({ title: '', content_md: '' });
  const [policySaving, setPolicySaving] = useState(false);

  const [brandsAdmin, setBrandsAdmin] = useState([]);
  const [brandsTabLoading, setBrandsTabLoading] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [brandEditId, setBrandEditId] = useState(null);
  const [brandName, setBrandName] = useState('');
  const [brandLogoFile, setBrandLogoFile] = useState(null);
  const [brandExistingLogo, setBrandExistingLogo] = useState(null);
  const [brandClearLogo, setBrandClearLogo] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [deleteBrandId, setDeleteBrandId] = useState(null);
  const [brandLogoPreviewUrl, setBrandLogoPreviewUrl] = useState(null);

  useEffect(() => {
    if (!brandLogoFile) {
      setBrandLogoPreviewUrl(null);
      return undefined;
    }
    const u = URL.createObjectURL(brandLogoFile);
    setBrandLogoPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [brandLogoFile]);

  const fetchCatalogStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { data } = await api.get('/catalog/stats');
      setCatalogStats(data);
    } catch (e) {
      setStatsError(e.response?.data?.error || e.message || 'Error');
      setCatalogStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || tab !== 'dashboard') return;
    fetchCatalogStats();
  }, [isAdmin, tab, fetchCatalogStats]);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const { data } = await api.get('/catalog/items', {
        params: {
          page,
          limit: 20,
          reference: refFilter || undefined,
          manufacturer_id: mfgBrandId || undefined,
          missing: itemsMissingFilter || undefined,
        },
      });
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setItemsError(e.response?.data?.error || e.message || 'Error');
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [page, refFilter, mfgBrandId, itemsMissingFilter]);

  useEffect(() => {
    if (!isAdmin || tab !== 'items') return;
    fetchItems();
  }, [isAdmin, tab, fetchItems]);

  const fetchQueues = useCallback(async () => {
    setQueuesLoading(true);
    try {
      const [c, i] = await Promise.all([
        api.get('/catalog/change-requests', { params: { status: 'pending' } }),
        api.get('/catalog/insert-requests', { params: { status: 'pending' } }),
      ]);
      setChgReq(c.data.requests ?? []);
      setInsReq(i.data.requests ?? []);
    } catch {
      setChgReq([]);
      setInsReq([]);
    } finally {
      setQueuesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchQueues();
  }, [isAdmin, fetchQueues]);

  const fetchSellers = useCallback(async () => {
    setSellersLoading(true);
    setSellersFetchError(null);
    try {
      const { data } = await api.get('/store-listings/admin/sellers');
      setSellers(data.sellers ?? []);
    } catch (err) {
      setSellers([]);
      const msg =
        err.response?.data?.error || err.message || 'No se pudieron cargar los perfiles de vendedor';
      setSellersFetchError(msg);
      toast.error(msg);
    } finally {
      setSellersLoading(false);
    }
  }, []);

  const fetchClickStats = useCallback(async (days = clickStatsDays) => {
    setClickStatsLoading(true);
    try {
      const { data } = await api.get(`/store-listings/admin/clicks?days=${days}`);
      setClickStats(data.stats ?? []);
    } catch {
      setClickStats([]);
    } finally {
      setClickStatsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModerationDialog = (userId, action) => {
    const seller = sellers.find((s) => s.user_id === userId);
    setModerationTarget({ userId, action });
    setModerationForm({
      rejection_reason: action === 'reject' ? (seller?.rejection_reason ?? '') : '',
      admin_notes: seller?.admin_notes ?? '',
    });
    setModerationDialogOpen(true);
  };

  const submitModeration = async () => {
    if (!moderationTarget) return;
    const { userId, action } = moderationTarget;
    const approved = action === 'approve';
    setSellerApproving(userId);
    try {
      const payload = {
        approved,
        admin_notes: moderationForm.admin_notes.trim() || null,
      };
      if (!approved) {
        payload.rejection_reason = moderationForm.rejection_reason.trim() || null;
      }
      const { data } = await api.post(`/store-listings/admin/sellers/${userId}/approve`, payload);
      setSellers((prev) =>
        prev.map((s) => (s.user_id === userId ? { ...s, ...data } : s)),
      );
      setModerationDialogOpen(false);
      setModerationTarget(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al actualizar el vendedor');
    } finally {
      setSellerApproving(null);
    }
  };

  const fetchPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    try {
      const { data } = await api.get('/store-listings/admin/policies');
      setPolicies(data.policies ?? []);
    } catch {
      setPolicies([]);
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || tab !== 'stores') return;
    fetchSellers();
    fetchClickStats(clickStatsDays);
    fetchPolicies();
  }, [isAdmin, tab, fetchSellers, fetchClickStats, fetchPolicies, clickStatsDays]);

  const openPolicyEdit = (policy) => {
    setPolicyEditSlug(policy.slug);
    setPolicyForm({ title: policy.title ?? '', content_md: policy.content_md ?? '' });
    setPolicyDialogOpen(true);
  };

  const savePolicy = async () => {
    setPolicySaving(true);
    try {
      const { data } = await api.put(`/store-listings/admin/policies/${policyEditSlug}`, policyForm);
      setPolicies((prev) => prev.map((p) => (p.slug === policyEditSlug ? data : p)));
      setPolicyDialogOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar la política');
    } finally {
      setPolicySaving(false);
    }
  };

  const createSeller = async (e) => {
    e.preventDefault();
    if (!createSellerForm.email.trim()) return alert('El email es obligatorio');
    if (!createSellerForm.store_name.trim()) return alert('El nombre de tienda es obligatorio');
    setCreateSellerSaving(true);
    try {
      const { data } = await api.post('/store-listings/admin/sellers', {
        email: createSellerForm.email.trim(),
        store_name: createSellerForm.store_name.trim(),
        store_description: createSellerForm.store_description.trim() || null,
        store_url: createSellerForm.store_url.trim() || null,
      });
      setSellers((prev) => [data, ...prev]);
      setCreateSellerOpen(false);
      setCreateSellerForm({ email: '', store_name: '', store_description: '', store_url: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Error al crear la tienda');
    } finally {
      setCreateSellerSaving(false);
    }
  };

  const fetchBrandsAdmin = useCallback(async () => {
    setBrandsTabLoading(true);
    try {
      const { data } = await api.get('/catalog/brands');
      setBrandsAdmin(data.brands ?? []);
    } catch {
      setBrandsAdmin([]);
    } finally {
      setBrandsTabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || tab !== 'brands') return;
    fetchBrandsAdmin();
  }, [isAdmin, tab, fetchBrandsAdmin]);

  const openCreateBrand = () => {
    setBrandEditId(null);
    setBrandName('');
    setBrandLogoFile(null);
    setBrandExistingLogo(null);
    setBrandClearLogo(false);
    setBrandDialogOpen(true);
  };

  const openEditBrand = (row) => {
    setBrandEditId(row.id);
    setBrandName(row.name ?? '');
    setBrandLogoFile(null);
    const u = row.logo_url != null && String(row.logo_url).trim() ? String(row.logo_url) : null;
    setBrandExistingLogo(u);
    setBrandClearLogo(false);
    setBrandDialogOpen(true);
  };

  const saveBrand = async () => {
    const n = brandName.trim();
    if (!n) {
      alert('El nombre de la marca es obligatorio');
      return;
    }
    setBrandSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', n);
      if (brandLogoFile) fd.append('logo', brandLogoFile);
      if (brandEditId && brandClearLogo) fd.append('clear_logo', 'true');
      if (brandEditId) {
        await api.put(`/catalog/brands/${brandEditId}`, fd);
      } else {
        await api.post('/catalog/brands', fd);
      }
      setBrandDialogOpen(false);
      fetchBrandsAdmin();
    } catch (e) {
      alert(e.response?.data?.error || e.message || 'Error al guardar la marca');
    } finally {
      setBrandSaving(false);
    }
  };

  const confirmDeleteBrand = async () => {
    if (!deleteBrandId) return;
    try {
      await api.delete(`/catalog/brands/${deleteBrandId}`);
      setDeleteBrandId(null);
      fetchBrandsAdmin();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const openCreate = () => {
    setEditMode('create');
    setEditingId(null);
    setForm(emptyItem);
    setImageFile(null);
    setExistingImageUrl(null);
    setNewImageObjectUrl(null);
    setEditOpen(true);
  };

  const openEdit = (row) => {
    setEditMode('edit');
    setEditingId(row.id);
    setForm({
      reference: row.reference ?? '',
      manufacturer_id: row.manufacturer_id ?? '',
      model_name: row.model_name ?? '',
      vehicle_type: row.vehicle_type ?? '',
      traction: row.traction ?? '',
      motor_position: row.motor_position ?? '',
      commercial_release_year:
        row.commercial_release_year != null && row.commercial_release_year !== ''
          ? String(row.commercial_release_year)
          : '',
      discontinued: Boolean(row.discontinued),
      upcoming_release: Boolean(row.upcoming_release),
    });
    setImageFile(null);
    const url = row.image_url != null && String(row.image_url).trim() ? String(row.image_url) : null;
    setExistingImageUrl(url);
    setNewImageObjectUrl(null);
    setEditOpen(true);
  };

  const openDuplicate = (row) => {
    setEditMode('duplicate');
    setEditingId(null);
    setForm({
      reference: '',
      manufacturer_id: row.manufacturer_id ?? '',
      model_name: row.model_name ?? '',
      vehicle_type: row.vehicle_type ?? '',
      traction: row.traction ?? '',
      motor_position: row.motor_position ?? '',
      commercial_release_year:
        row.commercial_release_year != null && row.commercial_release_year !== ''
          ? String(row.commercial_release_year)
          : '',
      discontinued: Boolean(row.discontinued),
      upcoming_release: Boolean(row.upcoming_release),
    });
    setImageFile(null);
    setExistingImageUrl(null);
    setNewImageObjectUrl(null);
    setEditOpen(true);
  };

  const saveItem = async () => {
    if (!form.manufacturer_id?.trim()) {
      alert('Selecciona una marca registrada');
      return;
    }
    setFormSaving(true);
    try {
      const fd = new FormData();
      fd.append('reference', form.reference);
      fd.append('manufacturer_id', form.manufacturer_id);
      fd.append('model_name', form.model_name);
      if (form.vehicle_type) fd.append('vehicle_type', form.vehicle_type);
      fd.append('traction', form.traction ?? '');
      fd.append('motor_position', form.motor_position ?? '');
      if (form.commercial_release_year) fd.append('commercial_release_year', form.commercial_release_year);
      fd.append('discontinued', form.discontinued ? 'true' : 'false');
      fd.append('upcoming_release', form.upcoming_release ? 'true' : 'false');
      if (imageFile) fd.append('image', imageFile);

      if (editMode === 'create' || editMode === 'duplicate') {
        await api.post('/catalog/items', fd);
      } else {
        await api.put(`/catalog/items/${editingId}`, fd);
      }
      setEditOpen(false);
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/catalog/items/${deleteId}`);
      setDeleteId(null);
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const runImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    setImportProgress({ current: 0, total: 0 });
    try {
      const data = await runCatalogImportStream(importFile, duplicateMode, (current, total) => {
        setImportProgress({ current, total });
      });
      setImportResult(data);
      fetchItems();
    } catch (e) {
      setImportResult({ error: e.message || 'Error al importar' });
    } finally {
      setImportLoading(false);
      setImportProgress(null);
    }
  };

  const approveChg = async (id) => {
    try {
      await api.post(`/catalog/change-requests/${id}/approve`);
      fetchQueues();
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const rejectChg = async (id) => {
    const reason = window.prompt('Motivo (opcional)') ?? '';
    try {
      await api.post(`/catalog/change-requests/${id}/reject`, { reason });
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const approveIns = async (id) => {
    try {
      await api.post(`/catalog/insert-requests/${id}/approve`);
      fetchQueues();
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const rejectIns = async (id) => {
    const reason = window.prompt('Motivo (opcional)') ?? '';
    try {
      await api.post(`/catalog/insert-requests/${id}/reject`, { reason });
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/vehicles" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="size-7" />
            Catálogo slot
          </h1>
          <p className="text-sm text-muted-foreground">Gestión del catálogo colaborativo (solo administradores).</p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircle className="size-4 mr-2" />
          Nuevo ítem
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="size-4 mr-1 inline" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="items">Ítems</TabsTrigger>
          <TabsTrigger value="brands">
            <Tag className="size-4 mr-1 inline" />
            Marcas
          </TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="size-4 mr-1 inline" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="queues">
            <GitPullRequest className="size-4 mr-1 inline" />
            Colas ({chgReq.length + insReq.length})
          </TabsTrigger>
          <TabsTrigger value="stores">
            <Store className="size-4 mr-1 inline" />
            Tiendas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Métricas del catálogo</h2>
              <p className="text-sm text-muted-foreground">
                Completitud ponderada (6 campos; la marca no entra). Imagen 30%; nombre, tipo, tracción, motor y año de comercialización 14% cada uno.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => fetchCatalogStats()} disabled={statsLoading}>
              {statsLoading ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>
          {statsLoading && !catalogStats ? (
            <Spinner className="mx-auto" />
          ) : statsError ? (
            <Alert variant="destructive">
              <AlertDescription>{statsError}</AlertDescription>
            </Alert>
          ) : catalogStats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ítems en catálogo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tabular-nums">{catalogStats.totalItems}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Completitud media (ponderada)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tabular-nums">
                      {catalogStats.weightedCompletenessPercent}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ítems 100% completos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold tabular-nums">
                      {catalogStats.fullyCompletePercent}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {catalogStats.fullyCompleteCount} de {catalogStats.totalItems}
                    </p>
                  </CardContent>
                </Card>
                <Card className="sm:col-span-2 lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pesos (API)</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1 font-mono">
                    <div>imagen {Math.round((catalogStats.weights?.image_url ?? 0.3) * 100)}%</div>
                    <div>
                      nombre / tipo / tracción / motor / año{' '}
                      {Math.round((catalogStats.weights?.model_name ?? 0.14) * 100)}% c/u
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Huecos en datos</CardTitle>
                    <CardDescription>
                      Conteos absolutos y % sobre el total de ítems. Pulsa una fila para listar solo esos ítems en la pestaña
                      Ítems.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y divide-border/60">
                    {[
                      {
                        key: 'withoutImage',
                        label: 'Sin imagen',
                        n: catalogStats.missing?.withoutImage ?? 0,
                      },
                      {
                        key: 'withoutVehicleType',
                        label: 'Sin tipo',
                        n: catalogStats.missing?.withoutVehicleType ?? 0,
                      },
                      {
                        key: 'withoutTraction',
                        label: 'Sin tracción',
                        n: catalogStats.missing?.withoutTraction ?? 0,
                      },
                      {
                        key: 'withoutMotor',
                        label: 'Sin motor (posición)',
                        n: catalogStats.missing?.withoutMotor ?? 0,
                      },
                      {
                        key: 'withoutYear',
                        label: 'Sin año de comercialización',
                        n: catalogStats.missing?.withoutYear ?? 0,
                      },
                    ].map((row) => {
                      const t = catalogStats.totalItems || 1;
                      const pct = Math.round(((row.n / t) * 10000)) / 100;
                      const missingParam = CATALOG_ITEMS_MISSING[row.key];
                      return (
                        <button
                          key={row.key}
                          type="button"
                          className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left transition-colors first:pt-0 last:pb-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            setPage(1);
                            setItemsMissingFilter(missingParam);
                            setTab('items');
                          }}
                        >
                          <span className="text-sm">{row.label}</span>
                          <span className="text-sm tabular-nums">
                            <strong>{row.n}</strong>
                            <span className="text-muted-foreground"> ({pct}%)</span>
                          </span>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Huecos (gráfico)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[min(320px,50vh)] w-full min-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { label: 'Sin imagen', value: catalogStats.missing?.withoutImage ?? 0 },
                          { label: 'Sin tipo', value: catalogStats.missing?.withoutVehicleType ?? 0 },
                          { label: 'Sin tracción', value: catalogStats.missing?.withoutTraction ?? 0 },
                          { label: 'Sin motor', value: catalogStats.missing?.withoutMotor ?? 0 },
                          { label: 'Sin año', value: catalogStats.missing?.withoutYear ?? 0 },
                        ]}
                        margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={56} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                          formatter={(v) => [v, 'Ítems']}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ítems" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="items" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
              <CardDescription>
                Listado con todas las referencias del catálogo.              
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Filtrar referencia"
                  value={refFilter}
                  onChange={e => { setRefFilter(e.target.value); setPage(1); }}
                  className="max-w-xs"
                />
                <div className="w-full max-w-xs shrink-0">
                  <CatalogBrandSelect
                    showLabel={false}
                    emptyOptionLabel="Todas las marcas"
                    required={false}
                    value={mfgBrandId}
                    onChange={(id) => {
                      setMfgBrandId(id);
                      setPage(1);
                    }}
                    id="admin-catalog-filter-brand"
                  />
                </div>
                <div className="w-full max-w-xs shrink-0">
                  <Select
                    value={itemsMissingFilter === '' ? '__all__' : itemsMissingFilter}
                    onValueChange={(v) => {
                      setPage(1);
                      setItemsMissingFilter(v === '__all__' ? '' : v);
                    }}
                  >
                    <SelectTrigger id="admin-catalog-filter-missing" className="w-full">
                      <SelectValue placeholder="Filtrar por hueco en datos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{CATALOG_MISSING_FILTER_LABELS['']}</SelectItem>
                      <SelectItem value="image">{CATALOG_MISSING_FILTER_LABELS.image}</SelectItem>
                      <SelectItem value="vehicle_type">{CATALOG_MISSING_FILTER_LABELS.vehicle_type}</SelectItem>
                      <SelectItem value="traction">{CATALOG_MISSING_FILTER_LABELS.traction}</SelectItem>
                      <SelectItem value="motor">{CATALOG_MISSING_FILTER_LABELS.motor}</SelectItem>
                      <SelectItem value="year">{CATALOG_MISSING_FILTER_LABELS.year}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="secondary" onClick={() => fetchItems()}>
                  Aplicar
                </Button>
              </div>
              {itemsLoading ? (
                <Spinner className="mx-auto" />
              ) : itemsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{itemsError}</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tracción</TableHead>
                      <TableHead>Motor</TableHead>
                      <TableHead>Año</TableHead>
                      <TableHead className="whitespace-nowrap">Desc.</TableHead>
                      <TableHead className="whitespace-nowrap">Próx.</TableHead>
                      <TableHead className="w-0 text-right align-top">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.reference}</TableCell>
                        <TableCell>{row.manufacturer}</TableCell>
                        <TableCell>{row.model_name}</TableCell>
                        <TableCell>{row.vehicle_type || '—'}</TableCell>
                        <TableCell>{row.traction || '—'}</TableCell>
                        <TableCell>{labelMotorPosition(row.motor_position)}</TableCell>
                        <TableCell>{row.commercial_release_year ?? '—'}</TableCell>
                        <TableCell className="text-sm">{row.discontinued ? 'Sí' : '—'}</TableCell>
                        <TableCell className="text-sm">{row.upcoming_release ? 'Sí' : '—'}</TableCell>
                        <TableCell className="align-top text-right">
                          <div className="inline-flex min-w-[12.5rem] max-w-[16rem] flex-col items-stretch gap-2 sm:min-w-[17rem] sm:max-w-none">
                            <Button size="sm" variant="outline" className="w-full justify-center" asChild>
                              <Link
                                to={`/catalogo/${row.id}/${catalogSlugify(row.model_name || row.reference)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="size-3.5 mr-1 inline-block shrink-0 align-text-bottom" aria-hidden />
                                Ficha pública
                              </Link>
                            </Button>
                            <div className="grid grid-cols-2 gap-2">
                              <Button size="sm" variant="outline" className="w-full" onClick={() => openEdit(row)}>
                                Editar
                              </Button>
                              <Button size="sm" variant="outline" className="w-full" onClick={() => openDuplicate(row)}>
                                Duplicar
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="w-full"
                              onClick={() => setDeleteId(row.id)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} / {totalPages || 1}
                </span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Marcas del catálogo</CardTitle>
                <CardDescription>
                  Nombre canónico único (comparación sin distinguir mayúsculas). Logo opcional. Los ítems e importaciones deben usar estas marcas.
                </CardDescription>
              </div>
              <Button type="button" onClick={openCreateBrand}>
                <PlusCircle className="size-4 mr-2" />
                Nueva marca
              </Button>
            </CardHeader>
            <CardContent>
              {brandsTabLoading ? (
                <Spinner className="mx-auto" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Logo</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden sm:table-cell">Creada</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brandsAdmin.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          {b.logo_url ? (
                            <img
                              src={b.logo_url}
                              alt=""
                              className="h-10 w-10 rounded object-contain border bg-muted/30"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {b.created_at
                            ? new Date(b.created_at).toLocaleDateString('es-ES')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openEditBrand(b)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteBrandId(b.id)}>
                            Eliminar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar CSV o Excel</CardTitle>
              <CardDescription>
                La primera fila debe ser cabecera. La columna de marca (manufacturer / Marca) debe coincidir con el nombre de una marca registrada; si no, la fila fallará con un mensaje explícito.
                No hay importación JSON ni PDF: usa CSV o Excel; el PDF no está soportado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" accept=".csv,.xlsx,.xlsm,.xlsb,.xls,.xltx,.xltm" onChange={e => setImportFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <Label>Si la referencia y la marca ya existen</Label>
                <Select value={duplicateMode} onValueChange={setDuplicateMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Omitir fila</SelectItem>
                    <SelectItem value="update">Actualizar marca/nombre/año</SelectItem>
                    <SelectItem value="fail">Registrar error y continuar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runImport} disabled={!importFile || importLoading}>
                {importLoading ? 'Importando…' : 'Importar'}
              </Button>
              {importLoading && importProgress && (
                <div className="space-y-2 max-w-md">
                  <p className="text-sm text-muted-foreground">
                    {importProgress.total > 0
                      ? `Procesando filas: ${importProgress.current} / ${importProgress.total}`
                      : 'Leyendo archivo…'}
                  </p>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width] duration-150 ease-out rounded-full"
                      style={{
                        width:
                          importProgress.total > 0
                            ? `${Math.min(100, (importProgress.current / importProgress.total) * 100)}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
              )}
              {importResult && (
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                  {JSON.stringify(importResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-4 mt-4">
          {queuesLoading ? (
            <Spinner className="mx-auto" />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Ediciones propuestas</CardTitle>
                  <CardDescription>
                    Comparación respecto a la ficha actual. Revisa los campos antes de aprobar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chgReq.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ítem</TableHead>
                          <TableHead className="min-w-[280px]">Cambios propuestos</TableHead>
                          <TableHead className="whitespace-nowrap">Solicitante</TableHead>
                          <TableHead className="whitespace-nowrap">Recibida</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chgReq.map(r => (
                          <TableRow key={r.id}>
                            <TableCell>
                              {r.catalog_item_summary ? (
                                <div className="space-y-0.5">
                                  <Link
                                    to={`/catalogo/${r.catalog_item_summary.id}`}
                                    className="font-mono text-sm text-primary hover:underline"
                                  >
                                    {r.catalog_item_summary.reference}
                                  </Link>
                                  <div className="text-xs text-muted-foreground">
                                    {r.catalog_item_summary.manufacturer} — {r.catalog_item_summary.model_name}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {r.catalog_item_id
                                    ? `Ficha no encontrada (id en solicitud)`
                                    : '—'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              {!r.field_diffs?.length ? (
                                <span className="text-xs text-muted-foreground">
                                  Sin cambios detectados
                                </span>
                              ) : (
                                <ul className="text-sm space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {r.field_diffs.map((d, i) => (
                                    <li key={`${d.field}-${i}`} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                      {d.kind === 'image' ? (
                                        <div className="space-y-1">
                                          <span className="font-medium">{d.label}</span>
                                          <div className="flex flex-wrap items-center gap-2">
                                            {d.before ? (
                                              <img src={d.before} alt="" className="h-14 w-auto max-w-[120px] rounded border object-contain bg-muted/30" />
                                            ) : (
                                              <span className="text-xs text-muted-foreground">Sin imagen</span>
                                            )}
                                            <span className="text-muted-foreground">→</span>
                                            {d.after ? (
                                              <img src={d.after} alt="" className="h-14 w-auto max-w-[120px] rounded border object-contain bg-muted/30" />
                                            ) : (
                                              <span className="text-xs text-muted-foreground">Quitar imagen</span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div>
                                          <span className="font-medium">{d.label}</span>
                                          <div className="text-xs sm:text-sm mt-0.5 break-words">
                                            <span className="text-muted-foreground line-through decoration-muted-foreground/70">
                                              {formatCatalogDiffValue(d.field, d.before)}
                                            </span>
                                            <span className="mx-1 text-muted-foreground">→</span>
                                            <span>{formatCatalogDiffValue(d.field, d.after)}</span>
                                          </div>
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </TableCell>
                            <TableCell className="align-top text-xs break-all max-w-[14rem]">
                              {r.submitter_email ?? '—'}
                            </TableCell>
                            <TableCell className="align-top text-xs text-muted-foreground whitespace-nowrap">
                              {r.created_at
                                ? new Date(r.created_at).toLocaleString('es-ES', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right align-top space-x-2">
                              <Button size="sm" onClick={() => approveChg(r.id)}>Aprobar</Button>
                              <Button size="sm" variant="outline" onClick={() => rejectChg(r.id)}>Rechazar</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Altas propuestas</CardTitle>
                  <CardDescription>
                    Datos enviados por el usuario para crear una nueva ficha.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {insReq.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Marca / Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Tracción / motor</TableHead>
                          <TableHead>Año</TableHead>
                          <TableHead className="whitespace-nowrap">Desc. / próx.</TableHead>
                          <TableHead className="w-16">Img.</TableHead>
                          <TableHead className="text-xs max-w-[14rem]">Solicitante</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {insReq.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm">{r.proposed_reference}</TableCell>
                            <TableCell>{r.proposed_manufacturer} — {r.proposed_model_name}</TableCell>
                            <TableCell>{r.proposed_vehicle_type || '—'}</TableCell>
                            <TableCell className="text-sm">
                              {[r.proposed_traction, r.proposed_motor_position ? labelMotorPosition(r.proposed_motor_position) : null]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </TableCell>
                            <TableCell>{r.proposed_commercial_release_year ?? '—'}</TableCell>
                            <TableCell className="text-xs">
                              {[r.proposed_discontinued ? 'Descatalogado' : null, r.proposed_upcoming_release ? 'Próx. lanzamiento' : null]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </TableCell>
                            <TableCell>
                              {r.proposed_image_url ? (
                                <img
                                  src={r.proposed_image_url}
                                  alt=""
                                  className="h-11 w-11 rounded border object-contain bg-muted/30"
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs break-all max-w-[14rem] align-top">
                              {r.submitter_email ?? '—'}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button size="sm" onClick={() => approveIns(r.id)}>Aprobar</Button>
                              <Button size="sm" variant="outline" onClick={() => rejectIns(r.id)}>Rechazar</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ==================== TIENDAS ==================== */}
        <TabsContent value="stores" className="space-y-6 mt-4">
          {/* Vendedores */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="size-4" />
                  Perfiles de vendedor
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setCreateSellerOpen(true)}
                  >
                    <PlusCircle className="size-4 mr-1.5" />
                    Crear tienda
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSellers}
                    disabled={sellersLoading}
                  >
                    {sellersLoading ? 'Cargando…' : 'Actualizar'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sellersLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : sellers.length === 0 ? (
                <div className="py-8 px-4 space-y-3">
                  {sellersFetchError ? (
                    <Alert variant="destructive">
                      <AlertDescription className="text-sm">{sellersFetchError}</AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      No hay perfiles de tienda registrados. Si esperabas ver tiendas aprobadas, revisa que el
                      backend tenga <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> y que la migración{' '}
                      <code className="text-xs">20260420120000_catalog_pro</code> esté aplicada en Supabase.
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tienda</TableHead>
                        <TableHead>URL</TableHead>
                          <TableHead className="text-center">Estado</TableHead>
                          <TableHead className="hidden md:table-cell">Notas admin</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellers.map((s) => (
                        <TableRow key={s.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {s.logo_url ? (
                                <img
                                  src={s.logo_url}
                                  alt=""
                                  className="h-8 w-12 shrink-0 rounded-md object-contain bg-muted border border-border"
                                />
                              ) : (
                                <div className="h-8 w-12 shrink-0 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground border border-border">
                                  {(s.store_name || '?')[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">{s.store_name}</p>
                                {s.store_description && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[16rem]">
                                    {s.store_description}
                                  </p>
                                )}
                                {s.rejection_reason && !s.approved && (
                                  <p className="text-xs text-destructive mt-0.5 truncate max-w-[16rem]">
                                    Motivo: {s.rejection_reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {s.store_url ? (
                              <a
                                href={s.store_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                Visitar
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {s.approved ? (
                              <Badge variant="default" className="text-xs">Aprobado</Badge>
                            ) : s.reviewed_at ? (
                              <Badge variant="destructive" className="text-xs">Rechazado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Pendiente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[14rem]">
                            <span className="line-clamp-2">{s.admin_notes || '—'}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!s.approved ? (
                                <Button
                                  size="sm"
                                  disabled={sellerApproving === s.user_id}
                                  onClick={() => openModerationDialog(s.user_id, 'approve')}
                                >
                                  <CheckCircle2 className="size-3.5 mr-1.5" />
                                  Aprobar
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={sellerApproving === s.user_id}
                                  onClick={() => openModerationDialog(s.user_id, 'reject')}
                                >
                                  <XCircle className="size-3.5 mr-1.5" />
                                  Revocar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estadísticas de clics */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MousePointerClick className="size-4" />
                  Clics por listado
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(clickStatsDays)}
                    onValueChange={(v) => {
                      const d = parseInt(v, 10);
                      setClickStatsDays(d);
                      fetchClickStats(d);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 días</SelectItem>
                      <SelectItem value="30">Últimos 30 días</SelectItem>
                      <SelectItem value="90">Últimos 90 días</SelectItem>
                      <SelectItem value="365">Último año</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchClickStats(clickStatsDays)}
                    disabled={clickStatsLoading}
                  >
                    {clickStatsLoading ? 'Cargando…' : 'Actualizar'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {clickStatsLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-5" />
                </div>
              ) : clickStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sin datos de clics en el período seleccionado.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Listado</TableHead>
                        <TableHead>Tienda</TableHead>
                        <TableHead>Ítem del catálogo</TableHead>
                        <TableHead className="text-right">
                          <MousePointerClick className="size-4 inline" aria-label="Clics" />
                        </TableHead>
                        <TableHead className="text-center">Activo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clickStats.map((s) => (
                        <TableRow key={s.listing_id}>
                          <TableCell className="max-w-[12rem]">
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm hover:underline flex items-center gap-1 truncate"
                            >
                              {s.title}
                              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                            </a>
                          </TableCell>
                          <TableCell className="text-sm">{s.store_name ?? '—'}</TableCell>
                          <TableCell className="text-sm">
                            {s.catalog_item ? (
                              <span>
                                <span className="font-mono text-xs text-muted-foreground mr-1">
                                  {s.catalog_item.reference}
                                </span>
                                {s.catalog_item.model_name}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {s.click_count}
                          </TableCell>
                          <TableCell className="text-center">
                            {s.active ? (
                              <Badge variant="default" className="text-xs">Sí</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">No</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Políticas públicas */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Textos legales (políticas)</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchPolicies} disabled={policiesLoading}>
                  {policiesLoading ? 'Cargando…' : 'Actualizar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {policiesLoading ? (
                <div className="flex justify-center py-8"><Spinner className="size-5" /></div>
              ) : policies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin políticas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slug</TableHead>
                        <TableHead>Título</TableHead>
                        <TableHead>Última actualización</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((p) => (
                        <TableRow key={p.slug}>
                          <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                          <TableCell className="text-sm">{p.title || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.updated_at ? new Date(p.updated_at).toLocaleString('es-ES') : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => openPolicyEdit(p)}>
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      {/* Diálogo: moderación de vendedor (aprobar/rechazar con motivo) */}
      <Dialog open={moderationDialogOpen} onOpenChange={setModerationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {moderationTarget?.action === 'approve' ? 'Aprobar tienda' : 'Rechazar / revocar tienda'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {moderationTarget?.action === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="mod_reason">Motivo de rechazo (visible para el vendedor)</Label>
                <Input
                  id="mod_reason"
                  placeholder="Describe el motivo brevemente…"
                  value={moderationForm.rejection_reason}
                  onChange={(e) => setModerationForm((f) => ({ ...f, rejection_reason: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="mod_notes">Notas internas (solo admin)</Label>
              <Input
                id="mod_notes"
                placeholder="Notas privadas sobre esta tienda…"
                value={moderationForm.admin_notes}
                onChange={(e) => setModerationForm((f) => ({ ...f, admin_notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModerationDialogOpen(false)}>Cancelar</Button>
            <Button
              variant={moderationTarget?.action === 'reject' ? 'destructive' : 'default'}
              disabled={sellerApproving === moderationTarget?.userId}
              onClick={submitModeration}
            >
              {sellerApproving === moderationTarget?.userId ? <Spinner className="size-4 mr-2" /> : null}
              {moderationTarget?.action === 'approve' ? 'Aprobar' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: editar política */}
      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar política: <code className="font-mono text-sm">{policyEditSlug}</code></DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="pol_title">Título</Label>
              <Input
                id="pol_title"
                value={policyForm.title}
                onChange={(e) => setPolicyForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pol_content">Contenido (Markdown)</Label>
              <textarea
                id="pol_content"
                className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={policyForm.content_md}
                onChange={(e) => setPolicyForm((f) => ({ ...f, content_md: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyDialogOpen(false)}>Cancelar</Button>
            <Button disabled={policySaving} onClick={savePolicy}>
              {policySaving ? <Spinner className="size-4 mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: crear tienda (admin) */}
      <Dialog open={createSellerOpen} onOpenChange={setCreateSellerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear tienda</DialogTitle>
          </DialogHeader>
          <form onSubmit={createSeller} className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="cs_email">Email del usuario *</Label>
              <Input
                id="cs_email"
                type="email"
                placeholder="vendedor@tienda.com"
                value={createSellerForm.email}
                onChange={(e) => setCreateSellerForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                El usuario debe tener ya una cuenta registrada en la plataforma.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs_store_name">Nombre de la tienda *</Label>
              <Input
                id="cs_store_name"
                value={createSellerForm.store_name}
                onChange={(e) => setCreateSellerForm((f) => ({ ...f, store_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs_store_description">Descripción (opcional)</Label>
              <Input
                id="cs_store_description"
                value={createSellerForm.store_description}
                onChange={(e) => setCreateSellerForm((f) => ({ ...f, store_description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs_store_url">Web de la tienda (opcional)</Label>
              <Input
                id="cs_store_url"
                type="url"
                placeholder="https://..."
                value={createSellerForm.store_url}
                onChange={(e) => setCreateSellerForm((f) => ({ ...f, store_url: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateSellerOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createSellerSaving}>
                {createSellerSaving ? <Spinner className="size-4 mr-2" /> : null}
                Crear tienda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editMode === 'create'
                ? 'Nuevo ítem del catálogo'
                : editMode === 'duplicate'
                  ? 'Duplicar ítem'
                  : 'Editar ítem'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input name="reference" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <CatalogBrandSelect
              label="Marca"
              required
              value={form.manufacturer_id}
              onChange={(manufacturer_id) => setForm((f) => ({ ...f, manufacturer_id }))}
            />
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre / modelo</Label>
              <Input value={form.model_name} onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.vehicle_type || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, vehicle_type: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin tipo —</SelectItem>
                  {VEHICLE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CatalogTractionSelect
              value={form.traction}
              onChange={(traction) => setForm((f) => ({ ...f, traction }))}
              id="catalog-item-traction"
            />
            <div className="space-y-2">
              <Label>Posición del motor</Label>
              <Select
                value={form.motor_position || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, motor_position: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin especificar —</SelectItem>
                  {MOTOR_POSITION_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año de comercialización</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                placeholder="ej. 2020"
                value={form.commercial_release_year}
                onChange={e => setForm(f => ({ ...f, commercial_release_year: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Solo el año (opcional).</p>
            </div>
            <div className="flex flex-col gap-4 rounded-lg border p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div className="flex items-center justify-between gap-3 sm:min-w-[200px]">
                <Label htmlFor="catalog-discontinued" className="cursor-pointer">
                  Descatalogado
                </Label>
                <Switch
                  id="catalog-discontinued"
                  checked={form.discontinued}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, discontinued: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3 sm:min-w-[220px]">
                <Label htmlFor="catalog-upcoming" className="cursor-pointer">
                  Próximo lanzamiento
                </Label>
                <Switch
                  id="catalog-upcoming"
                  checked={form.upcoming_release}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, upcoming_release: v }))}
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Imagen (opcional)</Label>
              {(newImageObjectUrl || existingImageUrl) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {newImageObjectUrl ? 'Vista previa (sustituirá la actual al guardar)' : 'Imagen actual'}
                  </p>
                  <img
                    src={newImageObjectUrl || existingImageUrl}
                    alt=""
                    className="max-h-36 w-auto max-w-full rounded-md border object-contain bg-muted/30"
                  />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={e => setImageFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveItem} disabled={formSaving}>
              {formSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ítem del catálogo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{brandEditId ? 'Editar marca' : 'Nueva marca'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Ej. Scalextric"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo (opcional)</Label>
              {(brandLogoPreviewUrl || (brandExistingLogo && !brandClearLogo)) && (
                <img
                  src={brandLogoPreviewUrl || brandExistingLogo}
                  alt=""
                  className="max-h-24 w-auto rounded border object-contain bg-muted/30"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  setBrandLogoFile(e.target.files?.[0] || null);
                  setBrandClearLogo(false);
                }}
              />
              {brandEditId && brandExistingLogo && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={brandClearLogo}
                    onChange={(e) => {
                      setBrandClearLogo(e.target.checked);
                      if (e.target.checked) setBrandLogoFile(null);
                    }}
                  />
                  Quitar logo actual
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBrandDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveBrand} disabled={brandSaving}>
              {brandSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBrandId} onOpenChange={() => setDeleteBrandId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta marca?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede si no hay ítems ni solicitudes de alta que la usen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBrand}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminSlotCatalog;
