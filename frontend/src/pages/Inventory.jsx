import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Package,
  Trash2,
  Pen,
  ExternalLink,
  Wrench,
  PackagePlus,
  History,
  Copy,
  Calendar,
  Car,
} from 'lucide-react';
import api from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Spinner } from '../components/ui/spinner';
import { toast } from 'sonner';
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
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SearchableCategorySelect } from '../components/SearchableCategorySelect';
import PageRangePagination from '../components/PageRangePagination';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  formatInventoryCategory,
  formatHistoryDate,
} from '../utils/formatUtils';
import { buildInventoryListQueryParams } from '../utils/inventoryListQuery';

const emptyForm = () => ({
  name: '',
  reference: '',
  url: '',
  category: 'otro',
  quantity: '1',
  unit: 'uds',
  min_stock: '',
  purchase_price: '',
  purchase_date: '',
  notes: '',
  vehicle_id: 'none',
  manufacturer: '',
  material: '',
  size: '',
  color: '',
  teeth: '',
  rpm: '',
  gaus: '',
  description: '',
});

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];
const PAGE_SIZE_STORAGE_KEY = 'inventoryPageSize';

const Inventory = () => {
  const { t } = useTranslation('inventory');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, item: null });
  const [mountTarget, setMountTarget] = useState(null);
  const [mountForm, setMountForm] = useState(null);
  const [mountError, setMountError] = useState(null);
  const [mountSaving, setMountSaving] = useState(false);

  const [restockTarget, setRestockTarget] = useState(null);
  const [restockForm, setRestockForm] = useState(null);
  const [restockError, setRestockError] = useState(null);
  const [restockSaving, setRestockSaving] = useState(false);

  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [viewMode, setViewMode] = useState('parts');
  const [parts, setParts] = useState([]);
  const [onlyMounted, setOnlyMounted] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partForm, setPartForm] = useState(null);
  const [partSaving, setPartSaving] = useState(false);
  const [partFormError, setPartFormError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [pageSize, setPageSize] = useState(() => {
    try {
      const stored = parseInt(localStorage.getItem(PAGE_SIZE_STORAGE_KEY), 10);
      return PAGE_SIZE_OPTIONS.includes(stored) ? stored : 25;
    } catch {
      return 25;
    }
  });

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== debouncedQ) {
        setDebouncedQ(next);
        setCurrentPage(1);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput, debouncedQ]);

  const loadVehicles = useCallback(async () => {
    try {
      const limit = 250;
      let page = 1;
      /** @type {{ id: string }[]} */
      const all = [];
      let totalPages = 1;
      do {
        const { data } = await api.get('/vehicles', { params: { page, limit } });
        const list = data?.vehicles ?? (Array.isArray(data) ? data : []);
        all.push(...list);
        totalPages = data?.pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);
      setVehicles(all);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildInventoryListQueryParams({
        page: currentPage,
        limit: pageSize,
        category: categoryFilter,
        lowStock: lowStockOnly,
        q: debouncedQ,
        onlyMounted: viewMode === 'parts' ? onlyMounted : false,
      });
      if (viewMode === 'parts') {
        const { data } = await api.get('/inventory/parts', { params });
        const list = Array.isArray(data) ? data : (Array.isArray(data?.parts) ? data.parts : []);
        const nextPagination = data?.pagination || {
          total: list.length,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(list.length / pageSize) || 0,
        };
        setParts(list);
        setItems([]);
        setPagination(nextPagination);
      } else {
        const { data } = await api.get('/inventory', { params });
        const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const nextPagination = data?.pagination || {
          total: list.length,
          page: currentPage,
          limit: pageSize,
          totalPages: Math.ceil(list.length / pageSize) || 0,
        };
        setItems(list);
        setParts([]);
        setPagination(nextPagination);
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || t('errors.load'));
      setItems([]);
      setParts([]);
      setPagination({ total: 0, page: currentPage, limit: pageSize, totalPages: 0 });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t estable por idioma; no re-disparar fetch
  }, [categoryFilter, lowStockOnly, debouncedQ, viewMode, onlyMounted, currentPage, pageSize]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const initForm = (item = null) => {
    if (item) {
      setFormData({
        name: item.name || '',
        reference: item.reference ?? '',
        url: item.url ?? '',
        category: item.category || 'otro',
        quantity: String(item.quantity ?? 0),
        unit: item.unit || 'uds',
        min_stock: item.min_stock != null ? String(item.min_stock) : '',
        purchase_price: item.purchase_price != null ? String(item.purchase_price) : '',
        purchase_date: item.purchase_date ? String(item.purchase_date).slice(0, 10) : '',
        notes: item.notes ?? '',
        vehicle_id: item.vehicle_id || 'none',
        manufacturer: item.manufacturer ?? '',
        material: item.material ?? '',
        size: item.size ?? '',
        color: item.color ?? '',
        teeth: item.teeth != null ? String(item.teeth) : '',
        rpm: item.rpm != null ? String(item.rpm) : '',
        gaus: item.gaus != null ? String(item.gaus) : '',
        description: item.description ?? '',
      });
      setEditingItem(item);
    } else {
      setFormData(emptyForm());
      setEditingItem(null);
    }
    setFormError(null);
  };

  const handleOpenCreate = () => {
    initForm(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    initForm(item);
    setShowModal(true);
  };

  const handleDuplicate = (item) => {
    setFormData({
      name: `${(item.name || '').trim()}${t('duplicate.nameSuffix')}`,
      reference: item.reference ?? '',
      url: item.url ?? '',
      category: item.category || 'otro',
      quantity: '0',
      unit: item.unit || 'uds',
      min_stock: item.min_stock != null ? String(item.min_stock) : '',
      purchase_price: item.purchase_price != null ? String(item.purchase_price) : '',
      purchase_date: item.purchase_date ? String(item.purchase_date).slice(0, 10) : '',
      notes: item.notes ?? '',
      vehicle_id: 'none',
      manufacturer: item.manufacturer ?? '',
      material: item.material ?? '',
      size: item.size ?? '',
      color: item.color ?? '',
      teeth: item.teeth != null ? String(item.teeth) : '',
      rpm: item.rpm != null ? String(item.rpm) : '',
      gaus: item.gaus != null ? String(item.gaus) : '',
      description: item.description ?? '',
    });
    setEditingItem(null);
    setFormError(null);
    setShowModal(true);
  };

  const openInventoryTargetId =
    location.state?.openInventoryEditId ?? searchParams.get('edit') ?? null;

  useEffect(() => {
    if (!openInventoryTargetId) return;
    let cancelled = false;

    const clearOpenIntent = () => {
      const qs = new URLSearchParams(searchParams);
      qs.delete('edit');
      const search = qs.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : '' },
        { replace: true, state: {} },
      );
    };

    (async () => {
      try {
        let item = items.find((i) => String(i.id) === String(openInventoryTargetId));
        if (!item) {
          const { data } = await api.get(`/inventory/${openInventoryTargetId}`);
          item = data;
        }
        if (cancelled) return;
        if (!item) {
          toast.error(t('toasts.itemNotFound'));
          clearOpenIntent();
          return;
        }
        handleOpenEdit(item);
        clearOpenIntent();
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast.error(t('errors.openItem'));
        }
        if (!cancelled) clearOpenIntent();
      }
    })();

    return () => {
      cancelled = true;
    };
    // Abrir desde búsqueda (state o ?edit=); items puede estar vacío en el primer render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openInventoryTargetId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(t('formErrors.nameRequired'));
      return;
    }
    const qty = parseInt(formData.quantity, 10);
    if (Number.isNaN(qty) || qty < 0) {
      setFormError(t('formErrors.quantityInvalid'));
      return;
    }

    let teethVal = null;
    if (formData.teeth.trim() !== '') {
      teethVal = parseInt(formData.teeth, 10);
      if (Number.isNaN(teethVal)) {
        setFormError(t('formErrors.teethInvalid'));
        return;
      }
    }
    let rpmVal = null;
    if (formData.rpm.trim() !== '') {
      rpmVal = Number(formData.rpm);
      if (Number.isNaN(rpmVal)) {
        setFormError(t('formErrors.rpmInvalid'));
        return;
      }
    }
    let gausVal = null;
    if (formData.gaus.trim() !== '') {
      gausVal = Number(formData.gaus);
      if (Number.isNaN(gausVal)) {
        setFormError(t('formErrors.gausInvalid'));
        return;
      }
    }

    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        name: formData.name.trim(),
        reference: formData.reference.trim() || null,
        url: formData.url.trim() || null,
        category: formData.category,
        quantity: qty,
        unit: formData.unit,
        min_stock: formData.min_stock.trim() === '' ? null : parseInt(formData.min_stock, 10),
        purchase_price: formData.purchase_price.trim() === '' ? null : Number(formData.purchase_price),
        purchase_date: formData.purchase_date.trim() === '' ? null : formData.purchase_date,
        notes: formData.notes.trim() || null,
        vehicle_id: formData.vehicle_id === 'none' ? null : formData.vehicle_id,
        manufacturer: formData.manufacturer.trim() || null,
        material: formData.material.trim() || null,
        size: formData.size.trim() || null,
        color: formData.color.trim() || null,
        teeth: teethVal,
        rpm: rpmVal,
        gaus: gausVal,
        description: formData.description.trim() || null,
      };

      if (payload.min_stock != null && (Number.isNaN(payload.min_stock) || payload.min_stock < 0)) {
        setFormError(t('formErrors.minStockInvalid'));
        setSaving(false);
        return;
      }
      if (payload.purchase_price != null && (Number.isNaN(payload.purchase_price) || payload.purchase_price < 0)) {
        setFormError(t('formErrors.priceInvalid'));
        setSaving(false);
        return;
      }

      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        toast.success(t('toasts.itemUpdated'));
      } else {
        await api.post('/inventory', payload);
        toast.success(t('toasts.itemCreated'));
      }

      setShowModal(false);
      setEditingItem(null);
      loadItems();
    } catch (err) {
      setFormError(err.response?.data?.error || t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setDeleteConfirm({ open: true, item });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.item) return;
    try {
      await api.delete(`/inventory/${deleteConfirm.item.id}`);
      setDeleteConfirm({ open: false, item: null });
      toast.success(t('toasts.itemDeleted'));
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || t('errors.delete'));
    }
  };

  const openMount = (item) => {
    setMountTarget(item);
    setMountForm({
      vehicle_id: item.vehicle_id || 'none',
      is_modification: true,
      mount_qty: '1',
      manufacturer: item.manufacturer || '',
      material: item.material || '',
      size: item.size || '',
      color: item.color || '',
      teeth: item.teeth != null ? String(item.teeth) : '',
      rpm: item.rpm != null ? String(item.rpm) : '',
      gaus: item.gaus != null ? String(item.gaus) : '',
      description: item.description || '',
    });
    setMountError(null);
  };

  const closeMount = () => {
    setMountTarget(null);
    setMountForm(null);
    setMountError(null);
  };

  const mountCat = (c) => String(c || '');
  const mountCategoryIs = (cat, ...values) => values.includes(mountCat(cat));

  const handleMountSubmit = async (e) => {
    e.preventDefault();
    if (!mountTarget || !mountForm) return;
    if (!mountForm.manufacturer?.trim()) {
      setMountError(t('mountErrors.manufacturerRequired'));
      return;
    }
    if (mountForm.vehicle_id === 'none' || !mountForm.vehicle_id) {
      setMountError(t('mountErrors.selectVehicle'));
      return;
    }
    const mq = parseInt(mountForm.mount_qty, 10);
    const maxQ = Number(mountTarget.quantity);
    if (Number.isNaN(mq) || mq < 1) {
      setMountError(t('mountErrors.mountQtyMin'));
      return;
    }
    if (mq > maxQ) {
      setMountError(t('mountErrors.insufficientStock', { available: maxQ }));
      return;
    }
    const cat = mountTarget.category;
    if (mountCategoryIs(cat, 'pinion', 'crown')) {
      if (mountForm.teeth === '' || Number.isNaN(Number(mountForm.teeth))) {
        setMountError(t('mountErrors.teethRequired'));
        return;
      }
    }
    if (mountCategoryIs(cat, 'motor')) {
      if (mountForm.rpm === '' || Number.isNaN(Number(mountForm.rpm))) {
        setMountError(t('mountErrors.rpmRequired'));
        return;
      }
    }
    try {
      setMountSaving(true);
      setMountError(null);
      await api.post(`/inventory/${mountTarget.id}/mount`, {
        vehicle_id: mountForm.vehicle_id,
        is_modification: mountForm.is_modification,
        mount_qty: mq,
        manufacturer: mountForm.manufacturer.trim(),
        material: mountForm.material.trim() || undefined,
        size: mountForm.size.trim() || undefined,
        color: mountForm.color.trim() || undefined,
        description: mountForm.description.trim() || undefined,
        teeth: mountForm.teeth !== '' ? Number(mountForm.teeth) : undefined,
        rpm: mountForm.rpm !== '' ? Number(mountForm.rpm) : undefined,
        gaus: mountForm.gaus !== '' ? Number(mountForm.gaus) : undefined,
      });
      toast.success(t('toasts.mounted'));
      closeMount();
      loadItems();
    } catch (err) {
      const msg = err.response?.data?.error || t('errors.mount');
      setMountError(msg);
      toast.error(msg);
    } finally {
      setMountSaving(false);
    }
  };

  const todayIsoDate = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const openRestock = (item) => {
    setRestockTarget(item);
    setRestockForm({
      quantity: '1',
      purchase_price: item.purchase_price != null ? String(item.purchase_price) : '',
      supplier: '',
      purchase_date: todayIsoDate(),
      notes: '',
    });
    setRestockError(null);
  };

  const closeRestock = () => {
    setRestockTarget(null);
    setRestockForm(null);
    setRestockError(null);
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockTarget || !restockForm) return;
    const addQty = parseInt(restockForm.quantity, 10);
    if (Number.isNaN(addQty) || addQty < 1) {
      setRestockError(t('restockErrors.quantityMin'));
      return;
    }
    if (!restockForm.supplier?.trim()) {
      setRestockError(t('restockErrors.supplierRequired'));
      return;
    }
    if (restockForm.purchase_price.trim() === '') {
      setRestockError(t('restockErrors.purchasePriceRequired'));
      return;
    }
    const price = Number(restockForm.purchase_price);
    if (Number.isNaN(price) || price < 0) {
      setRestockError(t('restockErrors.purchasePriceInvalid'));
      return;
    }
    try {
      setRestockSaving(true);
      setRestockError(null);
      if (restockTarget._createForPart) {
        const p = restockTarget._createForPart;
        await api.post('/inventory', {
          name: p.name,
          reference: p.reference,
          url: p.url,
          category: p.category,
          quantity: addQty,
          unit: restockTarget.unit || 'uds',
          purchase_price: price,
          purchase_date: restockForm.purchase_date.trim() || null,
          notes:
            restockForm.notes.trim() ||
            t('notes.purchasePrefix', { supplier: restockForm.supplier.trim() }),
          manufacturer: p.manufacturer,
          material: p.material,
          size: p.size,
          color: p.color,
          teeth: p.teeth,
          rpm: p.rpm,
          gaus: p.gaus,
          description: p.description,
        });
      } else {
        await api.post(`/inventory/${restockTarget.id}/restock`, {
          quantity: addQty,
          purchase_price: price,
          supplier: restockForm.supplier.trim(),
          purchase_date: restockForm.purchase_date.trim() || null,
          notes: restockForm.notes.trim() || null,
        });
      }
      toast.success(t('toasts.restockSuccess'));
      closeRestock();
      loadItems();
    } catch (err) {
      setRestockError(err.response?.data?.error || t('errors.restock'));
    } finally {
      setRestockSaving(false);
    }
  };

  const openHistory = async (item) => {
    setHistoryTarget(item);
    setHistoryEntries([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/inventory/${item.id}/purchase-history`);
      setHistoryEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setHistoryError(err.response?.data?.error || t('errors.historyLoad'));
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryTarget(null);
    setHistoryEntries([]);
    setHistoryError(null);
  };

  const firstStockLine = (view) =>
    (view?.inventory_lines || []).find((l) => Number(l.quantity) > 0) || view?.inventory_lines?.[0] || null;

  const openPartRestock = (view) => {
    const line = firstStockLine(view);
    if (line) {
      openRestock(line);
      return;
    }
    openRestock({
      _createForPart: view.part,
      name: view.part.name,
      unit: 'uds',
      purchase_price: null,
    });
  };

  const openPartMount = (view) => {
    const line = (view?.inventory_lines || []).find((l) => Number(l.quantity) > 0);
    if (!line) return;
    openMount({
      ...line,
      name: view.part.name,
      manufacturer: view.part.manufacturer || line.manufacturer,
      material: view.part.material || line.material,
      size: view.part.size || line.size,
      color: view.part.color || line.color,
      teeth: view.part.teeth ?? line.teeth,
      rpm: view.part.rpm ?? line.rpm,
      gaus: view.part.gaus ?? line.gaus,
      description: view.part.description || line.description,
      category: view.part.category || line.category,
    });
  };

  const openPartHistory = (view) => {
    const line = view?.inventory_lines?.[0];
    if (!line) {
      toast.info(t('toasts.noPartHistory'));
      return;
    }
    openHistory(line);
  };

  const openEditPart = (view) => {
    const p = view.part;
    setEditingPart(view);
    setPartForm({
      name: p.name || '',
      category: p.category || 'otro',
      reference: p.reference ?? '',
      url: p.url ?? '',
      manufacturer: p.manufacturer ?? '',
      material: p.material ?? '',
      size: p.size ?? '',
      color: p.color ?? '',
      teeth: p.teeth != null ? String(p.teeth) : '',
      rpm: p.rpm != null ? String(p.rpm) : '',
      gaus: p.gaus != null ? String(p.gaus) : '',
      description: p.description ?? '',
    });
    setPartFormError(null);
  };

  const closeEditPart = () => {
    setEditingPart(null);
    setPartForm(null);
    setPartFormError(null);
  };

  const handlePartSubmit = async (e) => {
    e.preventDefault();
    if (!editingPart || !partForm) return;
    if (!partForm.name.trim()) {
      setPartFormError(t('formErrors.nameRequired'));
      return;
    }
    try {
      setPartSaving(true);
      setPartFormError(null);
      const payload = {
        name: partForm.name.trim(),
        category: partForm.category,
        reference: partForm.reference.trim() || null,
        url: partForm.url.trim() || null,
        manufacturer: partForm.manufacturer.trim() || null,
        material: partForm.material.trim() || null,
        size: partForm.size.trim() || null,
        color: partForm.color.trim() || null,
        teeth: partForm.teeth.trim() === '' ? null : parseInt(partForm.teeth, 10),
        rpm: partForm.rpm.trim() === '' ? null : Number(partForm.rpm),
        gaus: partForm.gaus.trim() === '' ? null : Number(partForm.gaus),
        description: partForm.description.trim() || null,
      };
      if (payload.teeth != null && Number.isNaN(payload.teeth)) {
        setPartFormError(t('formErrors.teethInvalid'));
        setPartSaving(false);
        return;
      }
      if (payload.rpm != null && Number.isNaN(payload.rpm)) {
        setPartFormError(t('formErrors.rpmInvalid'));
        setPartSaving(false);
        return;
      }
      await api.put(`/inventory/parts/${editingPart.part.id}`, payload);
      toast.success(t('toasts.partUpdated'));
      closeEditPart();
      loadItems();
    } catch (err) {
      setPartFormError(err.response?.data?.error || t('errors.partSave'));
    } finally {
      setPartSaving(false);
    }
  };

  const isLowStock = (item) =>
    item.min_stock != null && Number(item.quantity) <= Number(item.min_stock);

  const unitLabel = (u) =>
    t(`units.${u}`, { defaultValue: INVENTORY_UNITS.find((x) => x.value === u)?.label || u });

  const catalogTotal = pagination.total;
  const totalPages = Math.max(1, pagination.totalPages || Math.ceil(catalogTotal / pageSize) || 1);
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const rangeStart = catalogTotal > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = catalogTotal > 0 ? Math.min(safePage * pageSize, catalogTotal) : 0;

  const handlePageSizeChange = (e) => {
    const next = parseInt(e.target.value, 10);
    if (!PAGE_SIZE_OPTIONS.includes(next)) return;
    setPageSize(next);
    setCurrentPage(1);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  };

  const handleLowStockChange = (value) => {
    setLowStockOnly(value);
    setCurrentPage(1);
  };

  const handleOnlyMountedChange = (value) => {
    setOnlyMounted(value);
    setCurrentPage(1);
  };

  const handleViewModeChange = (value) => {
    setViewMode(value);
    setCurrentPage(1);
  };

  const paginationUnitLabel =
    viewMode === 'parts'
      ? catalogTotal === 1
        ? t('pagination.unitPartsOne')
        : t('pagination.unitPartsMany')
      : catalogTotal === 1
        ? t('pagination.unitItemsOne')
        : t('pagination.unitItemsMany');

  const paginationBar = catalogTotal > 0 ? (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-muted-foreground order-2 sm:order-1">
        {t('pagination.showing', {
          start: rangeStart,
          end: rangeEnd,
          total: catalogTotal,
          unit: paginationUnitLabel,
        })}
      </div>
      <div className="order-1 sm:order-2">
        <PageRangePagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          disabled={loading}
        />
      </div>
      <div className="flex items-center gap-2 order-3">
        <label htmlFor="inv-page-size" className="text-sm text-muted-foreground whitespace-nowrap">
          {t('pagination.perPage')}
        </label>
        <select
          id="inv-page-size"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="flex h-9 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  ) : null;

  if (loading && items.length === 0 && parts.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {viewMode === 'parts' ? t('subtitle.parts') : t('subtitle.stock')}
          </p>
        </div>
        <Button className="flex items-center gap-2" onClick={handleOpenCreate}>
          <Plus className="size-4" />
          {t('actions.newItem')}
        </Button>
      </div>

      <Tabs value={viewMode} onValueChange={handleViewModeChange}>
        <TabsList>
          <TabsTrigger value="parts">{t('tabs.parts')}</TabsTrigger>
          <TabsTrigger value="stock">{t('tabs.stock')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, item: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.item
                ? t('deleteDialog.description', { name: deleteConfirm.item.name })
                : t('deleteDialog.descriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!mountTarget} onOpenChange={(open) => { if (!open) closeMount(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('mountDialog.title')}</DialogTitle>
            <DialogDescription>
              {mountTarget && mountForm
                ? (() => {
                    const n = Math.min(
                      Math.max(1, parseInt(mountForm.mount_qty, 10) || 1),
                      Number(mountTarget.quantity),
                    );
                    const left = Math.max(0, Number(mountTarget.quantity) - n);
                    return t('mountDialog.description', {
                      name: mountTarget.name,
                      count: n,
                      unitWord: n === 1 ? t('mountDialog.unitOne') : t('mountDialog.unitMany'),
                      left,
                    });
                  })()
                : ''}
            </DialogDescription>
          </DialogHeader>
          {mountTarget && mountForm && (
            <form onSubmit={handleMountSubmit}>
              <div className="space-y-4 py-2">
                {mountError && (
                  <Alert variant="destructive">
                    <AlertDescription>{mountError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label>{t('mountDialog.vehicle')}</Label>
                  <Select
                    value={mountForm.vehicle_id}
                    onValueChange={(v) => setMountForm({ ...mountForm, vehicle_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('mountDialog.selectVehicle')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('mountDialog.selectPlaceholder')}</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.manufacturer} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="mount-is-mod"
                    checked={mountForm.is_modification}
                    onCheckedChange={(checked) => setMountForm({ ...mountForm, is_modification: checked })}
                  />
                  <Label htmlFor="mount-is-mod" className="cursor-pointer">
                    {t('mountDialog.registerAsModification')}
                  </Label>
                </div>
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="mount-qty">{t('mountDialog.mountQtyLabel')}</Label>
                  <Input
                    id="mount-qty"
                    type="number"
                    min={1}
                    max={Number(mountTarget.quantity)}
                    value={mountForm.mount_qty}
                    onChange={(e) => setMountForm({ ...mountForm, mount_qty: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('mountDialog.mountQtyHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mount-mfg">{t('fields.manufacturer')}</Label>
                  <Input
                    id="mount-mfg"
                    value={mountForm.manufacturer}
                    onChange={(e) => setMountForm({ ...mountForm, manufacturer: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mount-mat">{t('fields.material')}</Label>
                    <Input
                      id="mount-mat"
                      value={mountForm.material}
                      onChange={(e) => setMountForm({ ...mountForm, material: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mount-size">{t('fields.size')}</Label>
                    <Input
                      id="mount-size"
                      value={mountForm.size}
                      onChange={(e) => setMountForm({ ...mountForm, size: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mount-color">{t('fields.color')}</Label>
                  <Input
                    id="mount-color"
                    value={mountForm.color}
                    onChange={(e) => setMountForm({ ...mountForm, color: e.target.value })}
                  />
                </div>
                {mountCategoryIs(mountTarget.category, 'pinion', 'crown') && (
                  <div className="space-y-2">
                    <Label htmlFor="mount-teeth">{t('fields.teeth')}</Label>
                    <Input
                      id="mount-teeth"
                      type="number"
                      value={mountForm.teeth}
                      onChange={(e) => setMountForm({ ...mountForm, teeth: e.target.value })}
                      required
                    />
                  </div>
                )}
                {mountCategoryIs(mountTarget.category, 'motor') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mount-rpm">{t('fields.rpm')}</Label>
                      <Input
                        id="mount-rpm"
                        type="number"
                        value={mountForm.rpm}
                        onChange={(e) => setMountForm({ ...mountForm, rpm: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mount-gaus">{t('fields.gaus')}</Label>
                      <Input
                        id="mount-gaus"
                        type="number"
                        value={mountForm.gaus}
                        onChange={(e) => setMountForm({ ...mountForm, gaus: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="mount-desc">{t('fields.description')}</Label>
                  <Textarea
                    id="mount-desc"
                    rows={2}
                    value={mountForm.description}
                    onChange={(e) => setMountForm({ ...mountForm, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeMount}>
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={mountSaving}>
                  {mountSaving ? (
                    <>
                      <Spinner className="size-4 mr-2" />
                      {t('mountDialog.mounting')}
                    </>
                  ) : (
                    t('mountDialog.submit')
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!restockTarget} onOpenChange={(open) => { if (!open) closeRestock(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('restockDialog.title')}</DialogTitle>
            <DialogDescription>
              {restockTarget
                ? t('restockDialog.description', { name: restockTarget.name })
                : ''}
            </DialogDescription>
          </DialogHeader>
          {restockTarget && restockForm && (
            <form onSubmit={handleRestockSubmit}>
              <div className="space-y-4 py-2">
                {restockError && (
                  <Alert variant="destructive">
                    <AlertDescription>{restockError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="restock-qty">{t('restockDialog.qtyLabel')}</Label>
                  <Input
                    id="restock-qty"
                    type="number"
                    min={1}
                    value={restockForm.quantity}
                    onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restock-supplier">{t('restockDialog.supplierLabel')}</Label>
                  <Input
                    id="restock-supplier"
                    value={restockForm.supplier}
                    onChange={(e) => setRestockForm({ ...restockForm, supplier: e.target.value })}
                    placeholder={t('restockDialog.supplierPlaceholder')}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="restock-price">{t('restockDialog.unitPriceLabel')}</Label>
                    <Input
                      id="restock-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={restockForm.purchase_price}
                      onChange={(e) => setRestockForm({ ...restockForm, purchase_price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restock-pdate">{t('restockDialog.purchaseDateLabel')}</Label>
                    <Input
                      id="restock-pdate"
                      type="date"
                      value={restockForm.purchase_date}
                      onChange={(e) => setRestockForm({ ...restockForm, purchase_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restock-notes">{t('restockDialog.notesLabel')}</Label>
                  <Textarea
                    id="restock-notes"
                    rows={2}
                    value={restockForm.notes}
                    onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })}
                    placeholder={t('restockDialog.notesPlaceholder')}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeRestock}>
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={restockSaving}>
                  {restockSaving ? (
                    <>
                      <Spinner className="size-4 mr-2" />
                      {t('restockDialog.saving')}
                    </>
                  ) : (
                    t('restockDialog.submit')
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyTarget} onOpenChange={(open) => { if (!open) closeHistory(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('historyDialog.title')}</DialogTitle>
            <DialogDescription>
              {historyTarget ? t('historyDialog.description', { name: historyTarget.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {historyError && (
              <Alert variant="destructive">
                <AlertDescription>{historyError}</AlertDescription>
              </Alert>
            )}
            {historyLoading && (
              <div className="flex justify-center py-6">
                <Spinner className="size-8" />
              </div>
            )}
            {!historyLoading && !historyError && historyEntries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('historyDialog.empty')}
              </p>
            )}
            {!historyLoading && historyEntries.length > 0 && (
              <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {historyEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1"
                  >
                    <div className="flex flex-wrap justify-between gap-2 font-medium">
                      <span>
                        +{entry.quantity}{' '}
                        {unitLabel(historyTarget?.unit || 'uds')}
                      </span>
                      <span className="text-muted-foreground">
                        {formatHistoryDate(entry.created_at)}
                      </span>
                    </div>
                    {entry.supplier && (
                      <p>
                        <span className="text-muted-foreground">{t('historyDialog.where')}</span> {entry.supplier}
                      </p>
                    )}
                    {entry.purchase_price != null && entry.purchase_price !== '' && (
                      <p>
                        <span className="text-muted-foreground">{t('historyDialog.unitPrice')}</span>{' '}
                        {Number(entry.purchase_price).toFixed(2)} €
                      </p>
                    )}
                    {entry.purchase_date && (
                      <p>
                        <span className="text-muted-foreground">{t('historyDialog.purchaseDate')}</span>{' '}
                        {formatHistoryDate(entry.purchase_date)}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground pt-1 border-t border-border">{entry.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeHistory}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? t('itemDialog.editTitle') : t('itemDialog.newTitle')}</DialogTitle>
            <DialogDescription>
              {t('itemDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-1">
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <section className="space-y-4" aria-labelledby="inv-modal-h-producto">
                <h3 id="inv-modal-h-producto" className="text-sm font-semibold text-foreground">
                  {t('itemDialog.sectionProduct')}
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="inv-name">{t('fields.name')}</Label>
                  <Input
                    id="inv-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder={t('itemDialog.namePlaceholder')}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label id="inv-category-label" htmlFor="inv-category">
                      {t('fields.category')}
                    </Label>
                    <SearchableCategorySelect
                      id="inv-category"
                      aria-labelledby="inv-category-label"
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                      options={INVENTORY_CATEGORIES}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('itemDialog.stockUnit')}</Label>
                    <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVENTORY_UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-ref">{t('fields.reference')}</Label>
                  <Input
                    id="inv-ref"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder={t('itemDialog.referencePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-url">{t('fields.url')}</Label>
                  <Input
                    id="inv-url"
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder={t('itemDialog.urlPlaceholder')}
                  />
                </div>
              </section>

              <Separator />

              <section className="space-y-4" aria-labelledby="inv-modal-h-stock">
                <h3 id="inv-modal-h-stock" className="text-sm font-semibold text-foreground">
                  {t('itemDialog.sectionStock')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inv-qty">{t('itemDialog.qtyInStock')}</Label>
                    <Input
                      id="inv-qty"
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-min">{t('fields.minStock')}</Label>
                    <Input
                      id="inv-min"
                      type="number"
                      min="0"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                      placeholder={t('itemDialog.optional')}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inv-price">{t('fields.unitPrice')}</Label>
                    <Input
                      id="inv-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      placeholder={t('itemDialog.optional')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('itemDialog.unitPriceHint')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-pdate">{t('fields.purchaseDate')}</Label>
                    <Input
                      id="inv-pdate"
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <Separator />

              <section
                className="space-y-4 rounded-lg border border-border bg-muted/30 p-4 sm:p-5"
                aria-labelledby="inv-modal-h-spec"
              >
                <div className="space-y-1">
                  <h3 id="inv-modal-h-spec" className="text-sm font-semibold text-foreground">
                    {t('itemDialog.sectionTech')}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('itemDialog.sectionTechHint')}
                  </p>
                </div>
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <Label htmlFor="inv-mfg">{t('fields.manufacturer')}</Label>
                    <Input
                      id="inv-mfg"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder={t('itemDialog.manufacturerPlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inv-mat">{t('fields.material')}</Label>
                      <Input
                        id="inv-mat"
                        value={formData.material}
                        onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inv-size">{t('fields.size')}</Label>
                      <Input
                        id="inv-size"
                        value={formData.size}
                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inv-color">{t('fields.color')}</Label>
                    <Input
                      id="inv-color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </div>
                  {mountCategoryIs(formData.category, 'pinion', 'crown') && (
                    <div className="space-y-2">
                      <Label htmlFor="inv-teeth">{t('fields.teeth')}</Label>
                      <Input
                        id="inv-teeth"
                        type="number"
                        value={formData.teeth}
                        onChange={(e) => setFormData({ ...formData, teeth: e.target.value })}
                        placeholder={t('itemDialog.teethPlaceholder')}
                      />
                    </div>
                  )}
                  {mountCategoryIs(formData.category, 'motor') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="inv-rpm">{t('fields.rpm')}</Label>
                        <Input
                          id="inv-rpm"
                          type="number"
                          value={formData.rpm}
                          onChange={(e) => setFormData({ ...formData, rpm: e.target.value })}
                          placeholder={t('itemDialog.rpmPlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inv-gaus">{t('fields.gaus')}</Label>
                        <Input
                          id="inv-gaus"
                          type="number"
                          value={formData.gaus}
                          onChange={(e) => setFormData({ ...formData, gaus: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="inv-spec-desc">{t('fields.techDescription')}</Label>
                    <Textarea
                      id="inv-spec-desc"
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t('itemDialog.techDescPlaceholder')}
                    />
                  </div>
                </div>
              </section>

              <Separator />

              <section className="space-y-4" aria-labelledby="inv-modal-h-context">
                <h3 id="inv-modal-h-context" className="text-sm font-semibold text-foreground">
                  {t('itemDialog.sectionLocation')}
                </h3>
                <div className="space-y-2">
                  <Label>{t('itemDialog.mountedVehicle')}</Label>
                  <Select value={formData.vehicle_id} onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('itemDialog.none')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('itemDialog.none')}</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.manufacturer} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('itemDialog.mountedVehicleHint')}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-notes">{t('itemDialog.purchaseNotes')}</Label>
                  <Textarea
                    id="inv-notes"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t('itemDialog.purchaseNotesPlaceholder')}
                  />
                </div>
              </section>
            </div>
            <DialogFooter className="gap-2 border-t pt-4 mt-2 sm:mt-0 sm:pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    {t('itemDialog.saving')}
                  </>
                ) : (
                  t('actions.save')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPart} onOpenChange={(open) => { if (!open) closeEditPart(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('partDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('partDialog.description')}
            </DialogDescription>
          </DialogHeader>
          {partForm && (
            <form onSubmit={handlePartSubmit}>
              <div className="space-y-4 py-2">
                {partFormError && (
                  <Alert variant="destructive">
                    <AlertDescription>{partFormError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="part-name">{t('fields.name')}</Label>
                  <Input
                    id="part-name"
                    value={partForm.name}
                    onChange={(e) => setPartForm({ ...partForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part-category">{t('fields.category')}</Label>
                  <SearchableCategorySelect
                    id="part-category"
                    value={partForm.category}
                    onValueChange={(v) => setPartForm({ ...partForm, category: v })}
                    options={INVENTORY_CATEGORIES}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="part-mfg">{t('fields.brand')}</Label>
                    <Input
                      id="part-mfg"
                      value={partForm.manufacturer}
                      onChange={(e) => setPartForm({ ...partForm, manufacturer: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="part-ref">{t('fields.reference')}</Label>
                    <Input
                      id="part-ref"
                      value={partForm.reference}
                      onChange={(e) => setPartForm({ ...partForm, reference: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part-url">{t('fields.url')}</Label>
                  <Input
                    id="part-url"
                    type="url"
                    value={partForm.url}
                    onChange={(e) => setPartForm({ ...partForm, url: e.target.value })}
                  />
                </div>
                {mountCategoryIs(partForm.category, 'pinion', 'crown') && (
                  <div className="space-y-2">
                    <Label htmlFor="part-teeth">{t('fields.teeth')}</Label>
                    <Input
                      id="part-teeth"
                      type="number"
                      value={partForm.teeth}
                      onChange={(e) => setPartForm({ ...partForm, teeth: e.target.value })}
                    />
                  </div>
                )}
                {mountCategoryIs(partForm.category, 'motor') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="part-rpm">{t('fields.rpm')}</Label>
                      <Input
                        id="part-rpm"
                        type="number"
                        value={partForm.rpm}
                        onChange={(e) => setPartForm({ ...partForm, rpm: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="part-gaus">{t('fields.gaus')}</Label>
                      <Input
                        id="part-gaus"
                        type="number"
                        value={partForm.gaus}
                        onChange={(e) => setPartForm({ ...partForm, gaus: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="part-mat">{t('fields.material')}</Label>
                    <Input
                      id="part-mat"
                      value={partForm.material}
                      onChange={(e) => setPartForm({ ...partForm, material: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="part-size">{t('fields.size')}</Label>
                    <Input
                      id="part-size"
                      value={partForm.size}
                      onChange={(e) => setPartForm({ ...partForm, size: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part-color">{t('fields.color')}</Label>
                  <Input
                    id="part-color"
                    value={partForm.color}
                    onChange={(e) => setPartForm({ ...partForm, color: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="part-desc">{t('fields.description')}</Label>
                  <Textarea
                    id="part-desc"
                    rows={2}
                    value={partForm.description}
                    onChange={(e) => setPartForm({ ...partForm, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeEditPart}>
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={partSaving}>
                  {partSaving ? (
                    <>
                      <Spinner className="size-4 mr-2" />
                      {t('partDialog.saving')}
                    </>
                  ) : (
                    t('actions.savePart')
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row gap-4 flex-wrap items-start lg:items-end">
        <div className="space-y-2 min-w-[180px]">
          <Label htmlFor="inv-filter-cat">{t('filters.category')}</Label>
          <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
            <SelectTrigger id="inv-filter-cat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
              {INVENTORY_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 flex-1 min-w-[200px] max-w-md">
          <Label htmlFor="inv-search">{t('filters.searchLabel')}</Label>
          <Input
            id="inv-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('filters.searchPlaceholder')}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="inv-low" checked={lowStockOnly} onCheckedChange={handleLowStockChange} />
          <Label htmlFor="inv-low" className="cursor-pointer">
            {t('filters.lowStockOnly')}
          </Label>
        </div>
        {viewMode === 'parts' && (
          <div className="flex items-center gap-2 pb-2">
            <Switch id="inv-mounted" checked={onlyMounted} onCheckedChange={handleOnlyMountedChange} />
            <Label htmlFor="inv-mounted" className="cursor-pointer">
              {t('filters.onlyMounted')}
            </Label>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (items.length > 0 || parts.length > 0) && (
        <div className="flex justify-center py-2">
          <Spinner className="size-6" />
        </div>
      )}

      {!loading && catalogTotal === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="size-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="mb-2">{viewMode === 'parts' ? t('empty.partsTitle') : t('empty.itemsTitle')}</h4>
            <p className="text-muted-foreground mb-6">
              {t('empty.description')}
            </p>
            <Button onClick={handleOpenCreate} className="flex items-center gap-2 mx-auto">
              <Plus className="size-4" />
              {t('empty.addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'parts' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {parts.map((view) => {
            const p = view.part;
            const stockLine = (view.inventory_lines || []).find((l) => Number(l.quantity) > 0);
            return (
              <Card
                key={p.id}
                className="relative flex h-full flex-col overflow-hidden hover:shadow-lg transition-shadow"
              >
                <CardContent className="flex flex-1 flex-col p-4">
                  <h3 className="font-semibold text-lg leading-tight break-words">{p.name}</h3>
                  {p.reference && (
                    <p className="text-sm text-muted-foreground">
                      {t('card.ref')} <span className="font-mono text-foreground/90">{p.reference}</span>
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary">{formatInventoryCategory(p.category)}</Badge>
                    {view.low_stock && <Badge variant="destructive">{t('badges.lowStock')}</Badge>}
                    {Number(view.stock_qty) === 0 && Number(view.mounted_qty) > 0 && (
                      <Badge variant="outline">{t('badges.mountedOnly')}</Badge>
                    )}
                    {p.manufacturer && <Badge variant="outline">{p.manufacturer}</Badge>}
                  </div>
                  <div className="mt-3 text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground">{t('card.inStock')}</span>{' '}
                      <span className="font-medium">{view.stock_qty}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('card.mountedQty')}</span>{' '}
                      <span className="font-medium">{view.mounted_qty}</span>
                    </div>
                  </div>
                  {Array.isArray(view.mounted_in) && view.mounted_in.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-start gap-1">
                        <Car className="size-3 shrink-0 mt-0.5" aria-hidden />
                        <span className="leading-snug">
                          {t('card.mountedOn')}{' '}
                          {view.mounted_in.map((m, idx) => (
                            <span key={`${m.component_id}-${m.vehicle.id}`}>
                              {idx > 0
                                ? idx === view.mounted_in.length - 1
                                  ? t('list.separatorAnd')
                                  : t('list.separatorComma')
                                : ''}
                              <Link
                                to={`/vehicles/${m.vehicle.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {m.vehicle.manufacturer} {m.vehicle.model}
                              </Link>
                              {m.mounted_qty > 1 ? ` (${m.mounted_qty})` : ''}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                  )}
                  <div
                    className="mt-auto flex w-full min-w-0 flex-nowrap items-center justify-end gap-0.5 overflow-x-auto border-t border-border pt-3"
                    role="toolbar"
                    aria-label={t('a11y.partToolbar')}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-8 w-8 shrink-0"
                      title={t('actions.restock')}
                      onClick={() => openPartRestock(view)}
                    >
                      <PackagePlus className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-8 w-8 shrink-0"
                      title={t('actions.history')}
                      onClick={() => openPartHistory(view)}
                    >
                      <History className="size-4" />
                    </Button>
                    {stockLine && (
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        className="h-8 w-8 shrink-0"
                        title={t('actions.mount')}
                        onClick={() => openPartMount(view)}
                      >
                        <Wrench className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-8 w-8 shrink-0"
                      title={t('actions.editPart')}
                      onClick={() => openEditPart(view)}
                    >
                      <Pen className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <Card
              key={item.id}
              className="relative flex h-full flex-col overflow-hidden hover:shadow-lg transition-shadow"
            >
              <CardContent className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold text-lg leading-tight break-words">{item.name}</h3>
                {item.reference && (
                  <p className="text-sm text-muted-foreground">
                    {t('card.ref')} <span className="font-mono text-foreground/90">{item.reference}</span>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="secondary">{formatInventoryCategory(item.category)}</Badge>
                  {isLowStock(item) && <Badge variant="destructive">{t('badges.lowStock')}</Badge>}
                </div>

                <div className="mt-3 text-sm">
                  <span className="text-muted-foreground">{t('card.quantity')}</span>{' '}
                  <span className="font-medium">
                    {item.quantity} {unitLabel(item.unit)}
                  </span>
                </div>
                {item.purchase_price != null && (
                  <div className="mt-1 text-sm">
                    <span className="text-muted-foreground">{t('card.unitPrice')}</span>{' '}
                    <span className="font-medium">{Number(item.purchase_price).toFixed(2)} €</span>
                  </div>
                )}

                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {item.purchase_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3 shrink-0" aria-hidden />
                      <span>{t('card.purchase')} {formatHistoryDate(item.purchase_date)}</span>
                    </div>
                  )}
                  {item.url && (
                    <div className="flex items-start gap-1 pt-0.5">
                      <ExternalLink className="size-3 shrink-0 mt-0.5" aria-hidden />
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 break-all text-primary hover:underline"
                      >
                        {t('card.openLink')}
                      </a>
                    </div>
                  )}
                  {Array.isArray(item.mounted_vehicles) && item.mounted_vehicles.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-start gap-1">
                        <Car className="size-3 shrink-0 mt-0.5" aria-hidden />
                        <span className="leading-snug">
                          {t('card.mountedOn')}{' '}
                          {item.mounted_vehicles.map((v, idx) => (
                            <span key={v.id}>
                              {idx > 0
                                ? idx === item.mounted_vehicles.length - 1
                                  ? t('list.separatorAnd')
                                  : t('list.separatorComma')
                                : ''}
                              <Link
                                to={`/vehicles/${v.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {v.manufacturer} {v.model}
                              </Link>
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {item.notes && (
                  <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">{item.notes}</p>
                )}

                <div
                  className="mt-auto flex w-full min-w-0 flex-nowrap items-center justify-end gap-0.5 overflow-x-auto border-t border-border pt-3"
                  role="toolbar"
                  aria-label={t('a11y.itemToolbar')}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-8 w-8 shrink-0"
                    title={t('actions.restock')}
                    onClick={() => openRestock(item)}
                  >
                    <PackagePlus className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-8 w-8 shrink-0"
                    title={t('actions.history')}
                    onClick={() => openHistory(item)}
                  >
                    <History className="size-4" />
                  </Button>
                  {Number(item.quantity) > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-8 w-8 shrink-0"
                      title={t('actions.mount')}
                      onClick={() => openMount(item)}
                    >
                      <Wrench className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-8 w-8 shrink-0"
                    title={t('actions.edit')}
                    onClick={() => handleOpenEdit(item)}
                  >
                    <Pen className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-8 w-8 shrink-0"
                    title={t('actions.duplicate')}
                    onClick={() => handleDuplicate(item)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title={t('actions.delete')}
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
          )}
          {paginationBar}
        </>
      )}
    </div>
  );
};

export default Inventory;
