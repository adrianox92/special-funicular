import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '../../lib/axios';
import {
  normalizeVehicleComponentType,
} from '../../data/componentTypes';
import { EMPTY_SPEC } from './constants';
import {
  getModificationSaveDialogInfo,
  inventoryCategoryToVehicleType,
  inventoryPickerRequestParams,
  INVENTORY_PICKER_PAGE_SIZE,
  parseInventoryPickerResponse,
  vehicleSpecSnapshotsDiffer,
} from './specSnapshot';

export function useVehicleSpecs(id, { t, setError, setDeleteConfirm, deleteConfirm }) {
  const [specEditBaseline, setSpecEditBaseline] = useState(null);
  const [specReturnDialogOpen, setSpecReturnDialogOpen] = useState(false);
  const [pendingSpecSave, setPendingSpecSave] = useState(null);
  const [specDeleteReturnToInventory, setSpecDeleteReturnToInventory] = useState(false);
  const [technicalSpecs, setTechnicalSpecs] = useState({
    modification: null,
    technical: null
  });
  const [editingSpec, setEditingSpec] = useState(null);
  const [newSpec, setNewSpec] = useState({ ...EMPTY_SPEC });
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState(null);
  const [selectedInventoryItemName, setSelectedInventoryItemName] = useState('');
  const [selectedInventoryMountQty, setSelectedInventoryMountQty] = useState('1');
  const [selectedInventoryMaxQty, setSelectedInventoryMaxQty] = useState(null);
  const [inventoryPickerOpen, setInventoryPickerOpen] = useState(false);
  const [inventoryPickerLoading, setInventoryPickerLoading] = useState(false);
  const [inventoryPickerLoadingMore, setInventoryPickerLoadingMore] = useState(false);
  const [inventoryPickerItems, setInventoryPickerItems] = useState([]);
  const [inventoryPickerPage, setInventoryPickerPage] = useState(1);
  const [inventoryPickerHasMore, setInventoryPickerHasMore] = useState(false);
  const [inventoryPickerQ, setInventoryPickerQ] = useState('');
  const pickerRequestId = useRef(0);
  const [deductFromInventory, setDeductFromInventory] = useState(null);
  const [matchedPart, setMatchedPart] = useState(null);
  const [inventoryPresence, setInventoryPresence] = useState('unknown');

  useEffect(() => {
    const loadTechnicalSpecs = async () => {
      setLoadingSpecs(true);
      try {
        const response = await api.get(`/vehicles/${id}/technical-specs`);
        const normalized = (response.data || []).map((spec) => ({
          ...spec,
          components: (spec.components || []).map((c) => ({
            ...c,
            component_type: normalizeVehicleComponentType(c.component_type),
          })),
        }));
        const specs = {
          modification: normalized.find((spec) => spec.is_modification),
          technical: normalized.find((spec) => !spec.is_modification),
        };
        setTechnicalSpecs(specs);
      } catch (error) {
        console.error('Error al cargar especificaciones técnicas:', error);
        setError(t('edit.errors.loadSpecs'));
      } finally {
        setLoadingSpecs(false);
      }
    };

    if (id) {
      loadTechnicalSpecs();
    }
  }, [id, t, setError]);

  useEffect(() => {
    if (deleteConfirm?.type === 'spec') {
      setSpecDeleteReturnToInventory(false);
    }
  }, [deleteConfirm]);

  const handleSpecChange = (e) => {
    const { name, value, type, checked } = e.target;
    const updateFn = editingSpec ? setEditingSpec : setNewSpec;
    updateFn(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditSpec = (spec, component) => {
    const mountedQtyStr = component.mounted_qty != null ? String(component.mounted_qty) : '1';
    setEditingSpec({
      id: spec.id,
      component_id: component.id,
      component_type: normalizeVehicleComponentType(component.component_type || ''),
      element: component.element || '',
      manufacturer: component.manufacturer || '',
      material: component.material || '',
      size: component.size || '',
      teeth: component.teeth || '',
      color: component.color || '',
      rpm: component.rpm || '',
      gaus: component.gaus || '',
      price: component.price || '',
      url: component.url || '',
      sku: component.sku || '',
      description: component.description || '',
      mounted_qty: mountedQtyStr,
      is_modification: spec.is_modification,
      change_effective_date: new Date().toISOString().slice(0, 10)
    });
    setSpecEditBaseline({
      component_type: normalizeVehicleComponentType(component.component_type || ''),
      element: component.element || '',
      manufacturer: component.manufacturer || '',
      material: component.material || '',
      size: component.size || '',
      teeth: component.teeth ?? '',
      color: component.color || '',
      rpm: component.rpm ?? '',
      gaus: component.gaus ?? '',
      price: component.price ?? '',
      url: component.url || '',
      sku: component.sku || '',
      description: component.description || '',
      mounted_qty: mountedQtyStr,
    });
    setSelectedInventoryItemId(null);
    setSelectedInventoryItemName('');
    setSelectedInventoryMountQty('1');
    setSelectedInventoryMaxQty(null);
  };

  const handleCancelEdit = () => {
    setEditingSpec(null);
    setSpecEditBaseline(null);
    setSelectedInventoryItemId(null);
    setSelectedInventoryItemName('');
    setSelectedInventoryMountQty('1');
    setSelectedInventoryMaxQty(null);
    setDeductFromInventory(null);
    setMatchedPart(null);
    setInventoryPresence('unknown');
    setNewSpec({ ...EMPTY_SPEC });
  };

  const loadInventoryForPicker = useCallback(async ({
    page = 1,
    q = '',
    append = false,
  } = {}) => {
    const reqId = ++pickerRequestId.current;
    if (append) setInventoryPickerLoadingMore(true);
    else {
      setInventoryPickerLoading(true);
      setInventoryPickerItems([]);
    }
    try {
      const params = inventoryPickerRequestParams(newSpec.component_type, {
        page,
        limit: INVENTORY_PICKER_PAGE_SIZE,
        q,
      });
      const { data } = await api.get('/inventory', { params });
      if (reqId !== pickerRequestId.current) return;
      const { items, pagination } = parseInventoryPickerResponse(data, {
        page,
        limit: INVENTORY_PICKER_PAGE_SIZE,
      });
      const totalPages = pagination.totalPages || 0;
      setInventoryPickerItems((prev) => (append ? [...prev, ...items] : items));
      setInventoryPickerPage(page);
      setInventoryPickerHasMore(page < totalPages);
      setInventoryPickerQ(q);
    } catch (e) {
      console.error(e);
      if (reqId !== pickerRequestId.current) return;
      if (!append) setInventoryPickerItems([]);
      setInventoryPickerHasMore(false);
    } finally {
      if (reqId === pickerRequestId.current) {
        setInventoryPickerLoading(false);
        setInventoryPickerLoadingMore(false);
      }
    }
  }, [newSpec.component_type]);

  const openInventoryPicker = useCallback(() => {
    setInventoryPickerOpen(true);
    setInventoryPickerQ('');
    loadInventoryForPicker({ page: 1, q: '', append: false });
  }, [loadInventoryForPicker]);

  const searchInventoryPicker = useCallback(
    (q) => loadInventoryForPicker({ page: 1, q, append: false }),
    [loadInventoryForPicker],
  );

  const loadMoreInventoryPicker = useCallback(() => {
    if (inventoryPickerLoading || inventoryPickerLoadingMore || !inventoryPickerHasMore) return;
    return loadInventoryForPicker({
      page: inventoryPickerPage + 1,
      q: inventoryPickerQ,
      append: true,
    });
  }, [
    inventoryPickerHasMore,
    inventoryPickerLoading,
    inventoryPickerLoadingMore,
    inventoryPickerPage,
    inventoryPickerQ,
    loadInventoryForPicker,
  ]);

  useEffect(() => {
    if (editingSpec || selectedInventoryItemId) {
      setMatchedPart(null);
      setInventoryPresence('unknown');
      return undefined;
    }
    const type = newSpec.component_type;
    const name = (newSpec.element || '').trim();
    const manufacturer = (newSpec.manufacturer || '').trim();
    if (!type || !name || !manufacturer) {
      setMatchedPart(null);
      setInventoryPresence('unknown');
      return undefined;
    }
    if ((type === 'pinion' || type === 'crown') && (newSpec.teeth === '' || Number.isNaN(Number(newSpec.teeth)))) {
      setMatchedPart(null);
      setInventoryPresence('unknown');
      return undefined;
    }
    if (type === 'motor' && (newSpec.rpm === '' || Number.isNaN(Number(newSpec.rpm)))) {
      setMatchedPart(null);
      setInventoryPresence('unknown');
      return undefined;
    }
    setInventoryPresence('unknown');
    const tmr = setTimeout(async () => {
      try {
        const params = {
          category: type === 'other' ? 'otro' : type,
          name,
          manufacturer,
        };
        if (newSpec.sku?.trim()) params.reference = newSpec.sku.trim();
        if (newSpec.teeth !== '') params.teeth = newSpec.teeth;
        if (newSpec.rpm !== '') params.rpm = newSpec.rpm;
        const { data } = await api.get('/inventory/parts/match', { params });
        if (data && data.part) {
          const lines = Array.isArray(data.inventory_lines) ? data.inventory_lines : [];
          setMatchedPart(data);
          setInventoryPresence(lines.length > 0 ? 'present' : 'missing');
        } else {
          setMatchedPart(null);
          setInventoryPresence('missing');
        }
      } catch (e) {
        console.error(e);
        setMatchedPart(null);
        setInventoryPresence('unknown');
      }
    }, 350);
    return () => clearTimeout(tmr);
  }, [
    editingSpec,
    selectedInventoryItemId,
    newSpec.component_type,
    newSpec.element,
    newSpec.manufacturer,
    newSpec.sku,
    newSpec.teeth,
    newSpec.rpm,
  ]);

  const handlePickInventoryItem = (item) => {
    setNewSpec((prev) => ({
      ...prev,
      component_type: normalizeVehicleComponentType(inventoryCategoryToVehicleType(item.category)),
      element: item.name || '',
      sku: item.reference || '',
      url: item.url || '',
      price: item.purchase_price != null ? String(item.purchase_price) : '',
      manufacturer: item.manufacturer || '',
      material: item.material || '',
      size: item.size || '',
      color: item.color || '',
      teeth: item.teeth != null ? String(item.teeth) : '',
      rpm: item.rpm != null ? String(item.rpm) : '',
      gaus: item.gaus != null ? String(item.gaus) : '',
      description: item.description || '',
    }));
    setSelectedInventoryItemId(item.id);
    setSelectedInventoryItemName(item.name || '');
    setSelectedInventoryMountQty('1');
    setSelectedInventoryMaxQty(Number(item.quantity));
    setInventoryPickerOpen(false);
  };

  const clearInventoryLink = () => {
    setSelectedInventoryItemId(null);
    setSelectedInventoryItemName('');
    setSelectedInventoryMountQty('1');
    setSelectedInventoryMaxQty(null);
  };

  const persistVehicleSpec = async ({
    fromInventory,
    isModificationTab,
    specData,
    invMountPayload,
    returnRemovedToInventory,
  }) => {
    if (fromInventory) {
      await api.post(`/inventory/${invMountPayload.itemId}/mount`, {
        vehicle_id: id,
        is_modification: isModificationTab,
        mount_qty: invMountPayload.mq,
        manufacturer: invMountPayload.manufacturer,
        material: invMountPayload.material,
        size: invMountPayload.size,
        color: invMountPayload.color,
        description: invMountPayload.description,
        teeth: invMountPayload.teeth,
        rpm: invMountPayload.rpm,
        gaus: invMountPayload.gaus,
      });
      toast.success(t('edit.toasts.mountedAndDeducted'));
    } else if (editingSpec) {
      const currentSpec = isModificationTab ? technicalSpecs.modification : technicalSpecs.technical;
      if (!currentSpec?.id) {
        setError(t('edit.errors.specNotFound'));
        return;
      }
      const putBody = { ...specData };
      if (isModificationTab) {
        putBody.return_removed_to_inventory = returnRemovedToInventory === true;
      }
      const res = await api.put(
        `/vehicles/${id}/technical-specs/${currentSpec.id}/components/${editingSpec.component_id}`,
        putBody,
      );
      if (res.data?.inventory_return_error) {
        toast.warning(t('edit.toasts.inventoryReturnError', { error: res.data.inventory_return_error }));
      } else if (isModificationTab && returnRemovedToInventory) {
        toast.success(t('edit.toasts.modUpdatedInventory'));
      } else if (isModificationTab && res.data?.inventory_deducted_qty) {
        toast.success(t('edit.toasts.modSavedDeducted', { qty: res.data.inventory_deducted_qty }));
      }
    } else {
      const created = await api.post(`/vehicles/${id}/technical-specs`, specData);
      if (created.data?.inventory_created_at_zero) {
        toast.success(t('edit.toasts.specCreatedInventoryZero'));
      } else {
        toast.success(
          specData.deduct_from_inventory
            ? t('edit.toasts.mountedAndDeducted')
            : t('edit.toasts.specCreated'),
        );
      }
    }

    const response = await api.get(`/vehicles/${id}/technical-specs`);
    const normalizedAfterSave = (response.data || []).map((spec) => ({
      ...spec,
      components: (spec.components || []).map((c) => ({
        ...c,
        component_type: normalizeVehicleComponentType(c.component_type),
      })),
    }));
    const updatedSpecs = {
      modification: normalizedAfterSave.find((spec) => spec.is_modification),
      technical: normalizedAfterSave.find((spec) => !spec.is_modification),
    };
    setTechnicalSpecs(updatedSpecs);
    handleCancelEdit();
  };

  const cancelModificationReturnDialog = () => {
    setSpecReturnDialogOpen(false);
    setPendingSpecSave(null);
  };

  const resolveModificationReturnChoice = async (returnRemoved) => {
    const pending = pendingSpecSave;
    setSpecReturnDialogOpen(false);
    setPendingSpecSave(null);
    if (!pending) return;
    try {
      setError(null);
      await persistVehicleSpec({
        fromInventory: false,
        isModificationTab: pending.isModificationTab,
        specData: pending.specData,
        returnRemovedToInventory: returnRemoved,
      });
    } catch (error) {
      console.error('Error al guardar especificación:', error);
      const msg = error.response?.data?.error || t('edit.errors.saveSpec');
      setError(msg);
      toast.error(msg);
    }
  };

  const handleAddSpec = async (e, isModificationTab = false) => {
    e.preventDefault();
    const fromInventory = !editingSpec && selectedInventoryItemId;
    const compType = editingSpec?.component_type || newSpec.component_type;
    if (!compType && !fromInventory) {
      setError('El tipo de componente es requerido');
      return;
    }
    try {
      setError(null);
      if (fromInventory) {
        if (!newSpec.manufacturer?.trim()) {
          setError('La marca del fabricante es requerida');
          return;
        }
        const mq = parseInt(selectedInventoryMountQty, 10);
        if (Number.isNaN(mq) || mq < 1) {
          setError('La cantidad a descontar debe ser al menos 1');
          return;
        }
        if (selectedInventoryMaxQty != null && mq > selectedInventoryMaxQty) {
          setError(`No hay suficiente stock (disponible: ${selectedInventoryMaxQty})`);
          return;
        }
        await persistVehicleSpec({
          fromInventory: true,
          isModificationTab,
          invMountPayload: {
            itemId: selectedInventoryItemId,
            mq,
            manufacturer: newSpec.manufacturer.trim(),
            material: newSpec.material?.trim() || undefined,
            size: newSpec.size?.trim() || undefined,
            color: newSpec.color?.trim() || undefined,
            description: newSpec.description?.trim() || undefined,
            teeth: newSpec.teeth === '' ? undefined : Number(newSpec.teeth),
            rpm: newSpec.rpm === '' ? undefined : Number(newSpec.rpm),
            gaus: newSpec.gaus === '' ? undefined : Number(newSpec.gaus),
          },
        });
        return;
      }

      const mountQtyVal = parseInt(editingSpec?.mounted_qty ?? newSpec.mounted_qty, 10);
      const mountedQty = Number.isNaN(mountQtyVal) || mountQtyVal < 1 ? 1 : mountQtyVal;
      const specData = {
        is_modification: isModificationTab,
        deduct_from_inventory: deductFromInventory == null ? isModificationTab : deductFromInventory,
        component_id: editingSpec?.component_id,
        components: [
          {
            component_type: normalizeVehicleComponentType(
              editingSpec?.component_type || newSpec.component_type,
            ),
            element: editingSpec?.element || newSpec.element,
            manufacturer: editingSpec?.manufacturer || newSpec.manufacturer,
            material: editingSpec?.material || newSpec.material,
            size: editingSpec?.size || newSpec.size,
            teeth: (editingSpec?.teeth || newSpec.teeth) === '' ? null : Number(editingSpec?.teeth || newSpec.teeth),
            color: editingSpec?.color || newSpec.color,
            rpm: (editingSpec?.rpm || newSpec.rpm) === '' ? null : Number(editingSpec?.rpm || newSpec.rpm),
            gaus: (editingSpec?.gaus || newSpec.gaus) === '' ? null : Number(editingSpec?.gaus || newSpec.gaus),
            price: (editingSpec?.price || newSpec.price) === '' ? null : Number(editingSpec?.price || newSpec.price),
            url: editingSpec?.url || newSpec.url,
            sku: editingSpec?.sku || newSpec.sku,
            description: editingSpec?.description || newSpec.description,
            mounted_qty: mountedQty,
          },
        ],
      };

      if (editingSpec && isModificationTab) {
        specData.change_effective_date = editingSpec.change_effective_date || undefined;
      }

      if (editingSpec) {
        const historyDiffers =
          specEditBaseline && vehicleSpecSnapshotsDiffer(specEditBaseline, editingSpec);
        if (isModificationTab && historyDiffers && specEditBaseline) {
          const dialogInfo = getModificationSaveDialogInfo(specEditBaseline, editingSpec);
          if (dialogInfo.mode === 'ask_inventory_return') {
            setPendingSpecSave({
              specData,
              isModificationTab,
              removedQty: dialogInfo.removedQty,
            });
            setSpecReturnDialogOpen(true);
            return;
          }
        }
        await persistVehicleSpec({
          fromInventory: false,
          isModificationTab,
          specData,
          returnRemovedToInventory: false,
        });
      } else {
        await persistVehicleSpec({
          fromInventory: false,
          isModificationTab,
          specData,
        });
      }
    } catch (error) {
      console.error('Error al guardar especificación:', error);
      const msg = error.response?.data?.error || t('edit.errors.saveSpec');
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDeleteSpec = (specId, componentId) => {
    const mod = technicalSpecs?.modification;
    const tech = technicalSpecs?.technical;
    const spec = mod?.id === specId ? mod : tech?.id === specId ? tech : null;
    const comp = spec?.components?.find((c) => c.id === componentId);
    setDeleteConfirm({
      type: 'spec',
      specId,
      componentId,
      isModification: !!spec?.is_modification,
      mountedQty: comp?.mounted_qty ?? 1,
      elementLabel: comp?.element || '',
    });
  };

  const confirmDeleteSpec = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'spec') return;
    const { specId, componentId, isModification } = deleteConfirm;
    const returnInv = !!isModification && specDeleteReturnToInventory;
    setDeleteConfirm(null);
    try {
      await api.delete(`/vehicles/${id}/technical-specs/${specId}/components/${componentId}`, {
        data: returnInv ? { return_to_inventory: true } : {},
      });
      const response = await api.get(`/vehicles/${id}/technical-specs`);
      const updatedSpecs = {
        modification: response.data.find((spec) => spec.is_modification),
        technical: response.data.find((spec) => !spec.is_modification),
      };
      setTechnicalSpecs(updatedSpecs);
      if (returnInv) {
        toast.success(t('edit.toasts.modDeletedInventory'));
      }
    } catch (error) {
      console.error('Error al eliminar especificación:', error);
      setError(error.response?.data?.error || t('edit.errors.deleteSpec'));
    }
  };

  return {
    specReturnDialogOpen,
    pendingSpecSave,
    specDeleteReturnToInventory,
    setSpecDeleteReturnToInventory,
    technicalSpecs,
    editingSpec,
    newSpec,
    loadingSpecs,
    selectedInventoryItemId,
    selectedInventoryItemName,
    selectedInventoryMountQty,
    setSelectedInventoryMountQty,
    selectedInventoryMaxQty,
    inventoryPickerOpen,
    setInventoryPickerOpen,
    inventoryPickerLoading,
    inventoryPickerLoadingMore,
    inventoryPickerItems,
    inventoryPickerHasMore,
    inventoryPickerQ,
    deductFromInventory,
    setDeductFromInventory,
    matchedPart,
    inventoryPresence,
    handleSpecChange,
    handleEditSpec,
    handleCancelEdit,
    loadInventoryForPicker,
    openInventoryPicker,
    searchInventoryPicker,
    loadMoreInventoryPicker,
    handlePickInventoryItem,
    clearInventoryLink,
    cancelModificationReturnDialog,
    resolveModificationReturnChoice,
    handleAddSpec,
    handleDeleteSpec,
    confirmDeleteSpec,
  };
}
