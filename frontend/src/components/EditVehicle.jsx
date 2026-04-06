import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Pencil,
  Trash2,
  Wrench,
  BarChart3,
  AlertTriangle,
  CircleCheck,
  Info,
  Package,
  LayoutPanelLeft,
} from 'lucide-react';
import api from '../lib/axios';
import TimingEvolutionChart from './charts/TimingEvolutionChart';
import SpeedEvolutionChart from './charts/SpeedEvolutionChart';
import TimingSpecsModal from './TimingSpecsModal';
import SessionPerformanceModal from './SessionPerformanceModal';
import SetupPerformanceAnalysis, { hasMultipleConfigs } from './SetupPerformanceAnalysis';
import MaintenanceCorrelationChart from './charts/MaintenanceCorrelationChart';
import MaintenanceLog from './MaintenanceLog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { cn } from './ui/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import {
  formatDistance,
  formatModificationSnapshot,
  formatHistoryDate,
  formatInventoryCategory,
  modificationLineTotal,
} from '../utils/formatUtils';
import {
  vehicleComponentTypes as componentTypes,
  normalizeVehicleComponentType,
  getVehicleComponentTypeLabel,
} from '../data/componentTypes';

const imageFields = [
  { name: 'front', label: 'Delantera' },
  { name: 'left', label: 'Perfil Izquierdo' },
  { name: 'right', label: 'Perfil Derecho' },
  { name: 'rear', label: 'Trasera' },
  { name: 'top', label: 'Superior' },
  { name: 'chassis', label: 'Chasis' },
  { name: 'three_quarters', label: 'Vista 3/4' },
];

const viewTypeMap = {
  'Delantera': 'front',
  'Perfil Izquierdo': 'left',
  'Perfil Derecho': 'right',
  'Trasera': 'rear',
  'Superior': 'top',
  'Chasis': 'chassis',
  'Vista 3/4': 'three_quarters',
  'front': 'front',
  'left': 'left',
  'right': 'right',
  'rear': 'rear',
  'top': 'top',
  'chassis': 'chassis',
  'three_quarters': 'three_quarters',
};

const vehicleTypes = ['Rally', 'GT', 'LMP', 'Hypercar', 'Grupo 5', 'Road Car', 'Clásico', 'DTM', 'F1', 'Camiones', 'Raid'];

/** Categoría de inventario (`otro`) → tipo de componente del vehículo (`other`). */
function inventoryCategoryToVehicleType(cat) {
  return cat === 'otro' ? 'other' : cat;
}

/** Alineado con COMPONENT_PAYLOAD_KEYS del backend (cambio de modificación → historial). */
const VEHICLE_SPEC_SNAPSHOT_KEYS = [
  'component_type',
  'element',
  'manufacturer',
  'material',
  'size',
  'teeth',
  'color',
  'rpm',
  'gaus',
  'price',
  'url',
  'sku',
  'description',
  'mounted_qty',
];

function normalizeSpecSnapshotValue(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(n) && String(n) === String(Number(v))) return n;
  return String(v);
}

function vehicleSpecSnapshotsDiffer(prev, next) {
  if (!prev || !next) return false;
  for (const k of VEHICLE_SPEC_SNAPSHOT_KEYS) {
    if (normalizeSpecSnapshotValue(prev[k]) !== normalizeSpecSnapshotValue(next[k])) return true;
  }
  return false;
}

/** Solo sube cantidad (misma pieza): guardar directo y descontar stock en servidor si aplica. */
function getModificationSaveDialogInfo(baseline, editing) {
  if (!baseline || !editing || !vehicleSpecSnapshotsDiffer(baseline, editing)) {
    return { mode: 'save_direct' };
  }
  const keysNoQty = VEHICLE_SPEC_SNAPSHOT_KEYS.filter((k) => k !== 'mounted_qty');
  const othersChanged = keysNoQty.some(
    (k) => normalizeSpecSnapshotValue(baseline[k]) !== normalizeSpecSnapshotValue(editing[k]),
  );
  const prevQ = Math.max(1, parseInt(baseline.mounted_qty, 10) || 1);
  const nextQ = Math.max(1, parseInt(editing.mounted_qty, 10) || 1);
  if (!othersChanged && nextQ > prevQ) {
    return { mode: 'save_direct' };
  }
  if (!othersChanged && nextQ < prevQ) {
    return { mode: 'ask_inventory_return', removedQty: prevQ - nextQ };
  }
  return { mode: 'ask_inventory_return', removedQty: prevQ };
}

const EditVehicle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [images, setImages] = useState({});
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingImage, setDeletingImage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [specEditBaseline, setSpecEditBaseline] = useState(null);
  const [specReturnDialogOpen, setSpecReturnDialogOpen] = useState(false);
  const [pendingSpecSave, setPendingSpecSave] = useState(null);
  const [specDeleteReturnToInventory, setSpecDeleteReturnToInventory] = useState(false);
  const [draggingOver, setDraggingOver] = useState(null);
  const imageRefs = useRef({});
  const [activeTab, setActiveTab] = useState('general');
  const [technicalSpecs, setTechnicalSpecs] = useState({
    modification: null,
    technical: null
  });
  const [editingSpec, setEditingSpec] = useState(null);
  const [newSpec, setNewSpec] = useState({
    component_type: '',
    element: '',
    manufacturer: '',
    material: '',
    size: '',
    teeth: '',
    color: '',
    rpm: '',
    gaus: '',
    price: '',
    url: '',
    sku: '',
    description: '',
    mounted_qty: '1',
    is_modification: false
  });
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [timings, setTimings] = useState([]);
  const [editingTiming, setEditingTiming] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [newTiming, setNewTiming] = useState({
    best_lap_time: '',
    total_time: '',
    laps: '',
    average_time: '',
    lane: '',
    circuit: '',
    circuit_id: '',
    timing_date: new Date().toISOString().split('T')[0],
    best_lap_timestamp: null,
    total_time_timestamp: null,
    average_time_timestamp: null,
    supply_voltage_volts: '',
  });
  const [loadingTimings, setLoadingTimings] = useState(false);
  const [timingNotice, setTimingNotice] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [selectedTiming, setSelectedTiming] = useState(null);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceTiming, setPerformanceTiming] = useState(null);
  const [timingHasLaps, setTimingHasLaps] = useState({});
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState(null);
  const [selectedInventoryItemName, setSelectedInventoryItemName] = useState('');
  const [selectedInventoryMountQty, setSelectedInventoryMountQty] = useState('1');
  const [selectedInventoryMaxQty, setSelectedInventoryMaxQty] = useState(null);
  const [inventoryPickerOpen, setInventoryPickerOpen] = useState(false);
  const [inventoryPickerLoading, setInventoryPickerLoading] = useState(false);
  const [inventoryPickerItems, setInventoryPickerItems] = useState([]);

  useEffect(() => {
    api.get('/circuits').then(r => setCircuits(r.data || [])).catch(() => {});
    api.get(`/vehicles/${id}`)
      .then(async res => {
        setVehicle(res.data);
        const imgRes = await api.get(`/vehicles/${id}/images`);
        const imgs = imgRes.data || [];
        const previewsObj = {};
        imgs.forEach(img => {
          const key = viewTypeMap[img.view_type] || img.view_type;
          previewsObj[key] = img.image_url;
        });
        setPreviews(previewsObj);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error al cargar vehículo:', error);
        setError('Error al cargar el vehículo');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    const observers = new Map();
    const timeouts = new Map();

    const setupResizeObserver = (element, key) => {
      if (element && !observers.has(key)) {
        const observer = new ResizeObserver(entries => {
          if (timeouts.has(key)) {
            cancelAnimationFrame(timeouts.get(key));
          }
          const timeoutId = requestAnimationFrame(() => {
            if (!Array.isArray(entries) || !entries.length) {
              return;
            }
          });
          timeouts.set(key, timeoutId);
        });
        observer.observe(element);
        observers.set(key, observer);
      }
    };

    Object.keys(imageRefs.current).forEach(key => {
      if (imageRefs.current[key]) {
        setupResizeObserver(imageRefs.current[key], key);
      }
    });

    return () => {
      timeouts.forEach(timeoutId => {
        if (timeoutId) {
          cancelAnimationFrame(timeoutId);
        }
      });
      observers.forEach(observer => observer.disconnect());
    };
  }, [previews, images]);

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
        setError('Error al cargar las especificaciones técnicas');
      } finally {
        setLoadingSpecs(false);
      }
    };

    if (id) {
      loadTechnicalSpecs();
    }
  }, [id]);

  useEffect(() => {
    const loadTimings = async () => {
      try {
        setLoadingTimings(true);
        const response = await api.get(`/vehicles/${id}/timings`);
        const timingsWithRecalculatedAverages = response.data.map(timing => {
          const averageTime = calculateAverageTime(timing.total_time, timing.laps, timing.best_lap_time);
          let average_time_timestamp = null;
          if (averageTime) {
            const avgMatch = averageTime.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
            if (avgMatch) {
              const [, minutes, seconds, milliseconds] = avgMatch.map(Number);
              average_time_timestamp = minutes * 60 + seconds + milliseconds / 1000;
            }
          }
          return {
            ...timing,
            average_time: averageTime || timing.average_time,
            average_time_timestamp: average_time_timestamp || timing.average_time_timestamp
          };
        });
        setTimings(timingsWithRecalculatedAverages);
      } catch (error) {
        console.error('Error al cargar tiempos:', error);
        setError('Error al cargar los tiempos');
      } finally {
        setLoadingTimings(false);
      }
    };

    if (id) {
      loadTimings();
    }
  }, [id]);

  // Derive has_laps from API response (GET /vehicles/:id/timings returns has_laps)
  useEffect(() => {
    const map = {};
    timings.forEach((t) => {
      if (t.id != null) map[t.id] = !!t.has_laps;
    });
    setTimingHasLaps(map);
  }, [timings]);

  useEffect(() => {
    if (deleteConfirm?.type === 'spec') {
      setSpecDeleteReturnToInventory(false);
    }
  }, [deleteConfirm]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setVehicle({
      ...vehicle,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleFileForField = (file, field) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImages(prev => ({ ...prev, [field]: file }));
    const reader = new FileReader();
    reader.onloadend = () => {
      requestAnimationFrame(() => {
        setPreviews(prev => ({ ...prev, [field]: reader.result }));
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e, field) => {
    const file = e.target.files[0];
    if (file) handleFileForField(file, field);
  };

  const handleDragEnter = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(field);
  };

  const handleDragLeave = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFileForField(file, field);
  };

  const handleDeleteImage = (viewType) => {
    setDeleteConfirm({ type: 'image', viewType });
  };

  const confirmDeleteImage = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'image') return;
    const viewType = deleteConfirm.viewType;
    setDeleteConfirm(null);
    setDeletingImage(viewType);
    try {
      await api.delete(`/vehicles/${id}/images/${viewType}`);
      setImages(prev => {
        const newImages = { ...prev };
        delete newImages[viewType];
        return newImages;
      });
      setPreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[viewType];
        return newPreviews;
      });
    } catch (error) {
      console.error('Error al eliminar imagen:', error);
      setError('Error al eliminar la imagen');
    } finally {
      setDeletingImage(null);
    }
  };

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
    setNewSpec({
      component_type: '',
      element: '',
      manufacturer: '',
      material: '',
      size: '',
      teeth: '',
      color: '',
      rpm: '',
      gaus: '',
      price: '',
      url: '',
      sku: '',
      description: '',
      mounted_qty: '1',
      is_modification: false
    });
  };

  const loadInventoryForPicker = async () => {
    setInventoryPickerLoading(true);
    try {
      const params = {};
      if (newSpec.component_type) {
        params.category = newSpec.component_type === 'other' ? 'otro' : newSpec.component_type;
      }
      const { data } = await api.get('/inventory', { params });
      const list = Array.isArray(data) ? data : [];
      setInventoryPickerItems(list.filter((i) => Number(i.quantity) > 0));
    } catch (e) {
      console.error(e);
      setInventoryPickerItems([]);
    } finally {
      setInventoryPickerLoading(false);
    }
  };

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
      toast.success('Pieza montada y stock actualizado');
    } else if (editingSpec) {
      const currentSpec = isModificationTab ? technicalSpecs.modification : technicalSpecs.technical;
      if (!currentSpec?.id) {
        setError('No se encontró la especificación técnica');
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
        toast.warning(`Cambios guardados, pero no se pudo añadir al inventario: ${res.data.inventory_return_error}`);
      } else if (isModificationTab && returnRemovedToInventory) {
        toast.success('Modificación actualizada y pieza retirada añadida al inventario');
      } else if (isModificationTab && res.data?.inventory_deducted_qty) {
        toast.success(
          `Modificación guardada; se descontaron ${res.data.inventory_deducted_qty} ud(s) del inventario`,
        );
      }
    } else {
      await api.post(`/vehicles/${id}/technical-specs`, specData);
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
      setError(error.response?.data?.error || 'Error al guardar la especificación técnica');
    }
  };

  const handleAddSpec = async (e, isModificationTab = false) => {
    e.preventDefault();
    const fromInventory = !editingSpec && selectedInventoryItemId && isModificationTab;
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
      setError(error.response?.data?.error || 'Error al guardar la especificación técnica');
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
        toast.success('Modificación eliminada y pieza añadida al inventario');
      }
    } catch (error) {
      console.error('Error al eliminar especificación:', error);
      setError(error.response?.data?.error || 'Error al eliminar la especificación técnica');
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const submitter = e.nativeEvent?.submitter;
    if (submitter?.name !== 'save-vehicle') {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      const processedVehicle = {
        ...vehicle,
        price: vehicle.price === '' || vehicle.price === null ? undefined : Number(vehicle.price),
        total_price: vehicle.total_price === '' || vehicle.total_price === null ? undefined : Number(vehicle.total_price)
      };

      Object.entries(processedVehicle).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value);
        }
      });

      imageFields.forEach(({ name }) => {
        if (images[name]) {
          formData.append('images', images[name], name);
        }
      });

      await api.put(`/vehicles/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/vehicles');
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
      setError(error.response?.data?.error || 'Error al actualizar el vehículo');
    } finally {
      setSaving(false);
    }
  };

  const calculateAverageTime = (totalTime, laps, bestLapTime) => {
    if (!totalTime || !laps || laps <= 0 || !bestLapTime) return '';

    const getSeconds = (timeStr) => {
      const match = timeStr.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
      if (!match) return null;
      const [, minutes, seconds, milliseconds] = match.map(Number);
      return minutes * 60 + seconds + milliseconds / 1000;
    };

    const totalSeconds = getSeconds(totalTime);
    const bestLapSeconds = getSeconds(bestLapTime);

    if (totalSeconds === null || bestLapSeconds === null) return '';

    const minimumTotalSeconds = bestLapSeconds * laps;
    if (totalSeconds < minimumTotalSeconds) {
      const minimumTime = `${String(Math.floor(minimumTotalSeconds / 60)).padStart(2, '0')}:${String(Math.floor(minimumTotalSeconds % 60)).padStart(2, '0')}.${String(Math.floor((minimumTotalSeconds % 1) * 1000)).padStart(3, '0')}`;
      setTimingNotice({
        variant: 'warning',
        message: `El tiempo total (${totalTime}) es menor que el mínimo posible (${minimumTime}) para ${laps} vueltas con mejor vuelta de ${bestLapTime}`,
      });
    } else {
      setTimingNotice(null);
    }

    const averageSeconds = totalSeconds / laps;
    const avgMinutes = Math.floor(averageSeconds / 60);
    const avgSeconds = Math.floor(averageSeconds % 60);
    const avgMilliseconds = Math.floor((averageSeconds % 1) * 1000);

    return `${String(avgMinutes).padStart(2, '0')}:${String(avgSeconds).padStart(2, '0')}.${String(avgMilliseconds).padStart(3, '0')}`;
  };

  const handleTimingChange = (e) => {
    const { name, value } = e.target;
    const targetTiming = editingTiming || newTiming;
    const updateFn = editingTiming ? setEditingTiming : setNewTiming;

    let timestamp = null;
    if (['best_lap_time', 'total_time', 'average_time'].includes(name)) {
      const match = value.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
      if (match) {
        const [, minutes, seconds, milliseconds] = match.map(Number);
        if (!isNaN(minutes) && !isNaN(seconds) && !isNaN(milliseconds)) {
          timestamp = minutes * 60 + seconds + milliseconds / 1000;
        }
      }
    }

    const updatedTiming = {
      ...targetTiming,
      [name]: value,
    };
    if (['best_lap_time', 'total_time', 'average_time'].includes(name)) {
      updatedTiming[`${name}_timestamp`] = timestamp;
    }

    if (name === 'total_time' || name === 'laps' || name === 'best_lap_time') {
      const totalTime = name === 'total_time' ? value : targetTiming.total_time;
      const laps = name === 'laps' ? value : targetTiming.laps;
      const bestLapTime = name === 'best_lap_time' ? value : targetTiming.best_lap_time;

      const averageTime = calculateAverageTime(totalTime, laps, bestLapTime);
      if (averageTime) {
        const avgMatch = averageTime.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
        if (avgMatch) {
          const [, minutes, seconds, milliseconds] = avgMatch.map(Number);
          updatedTiming.average_time = averageTime;
          updatedTiming.average_time_timestamp = minutes * 60 + seconds + milliseconds / 1000;
        }
      }
    }

    updateFn(updatedTiming);
  };

  const handleEditTiming = (timing) => {
    const averageTime = calculateAverageTime(timing.total_time, timing.laps, timing.best_lap_time);
    let average_time_timestamp = null;

    if (averageTime) {
      const avgMatch = averageTime.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
      if (avgMatch) {
        const [, minutes, seconds, milliseconds] = avgMatch.map(Number);
        average_time_timestamp = minutes * 60 + seconds + milliseconds / 1000;
      }
    }

    setEditingTiming({
      id: timing.id,
      best_lap_time: timing.best_lap_time,
      total_time: timing.total_time,
      laps: timing.laps,
      average_time: averageTime || timing.average_time,
      lane: timing.lane || '',
      circuit: timing.circuit || '',
      circuit_id: timing.circuit_id || '',
      timing_date: timing.timing_date,
      best_lap_timestamp: timing.best_lap_timestamp,
      total_time_timestamp: timing.total_time_timestamp,
      average_time_timestamp: average_time_timestamp || timing.average_time_timestamp,
      supply_voltage_volts:
        timing.supply_voltage_volts != null && timing.supply_voltage_volts !== ''
          ? String(timing.supply_voltage_volts)
          : '',
    });
  };

  const handleCancelEditTiming = () => {
    setEditingTiming(null);
    setNewTiming({
      best_lap_time: '',
      total_time: '',
      laps: '',
      average_time: '',
      lane: '',
      circuit: '',
      circuit_id: '',
      timing_date: new Date().toISOString().split('T')[0],
      best_lap_timestamp: null,
      total_time_timestamp: null,
      average_time_timestamp: null,
      supply_voltage_volts: '',
    });
  };

  const handleTimingVoltageBlur = async (timingId, raw) => {
    const trimmed = (raw ?? '').trim();
    const payload =
      trimmed === ''
        ? { supply_voltage_volts: null }
        : { supply_voltage_volts: parseFloat(trimmed.replace(',', '.')) };
    if (trimmed !== '' && !Number.isFinite(payload.supply_voltage_volts)) {
      setTimingNotice({ variant: 'warning', message: 'Voltaje no válido' });
      setTimeout(() => setTimingNotice(null), 3000);
      return;
    }
    try {
      const { data } = await api.patch(`/timings/${timingId}`, payload);
      setTimings((prev) => prev.map((t) => (t.id === data.id ? { ...t, ...data } : t)));
    } catch (err) {
      console.error(err);
      setTimingNotice({
        variant: 'warning',
        message: err.response?.data?.error || 'No se pudo guardar el voltaje',
      });
      setTimeout(() => setTimingNotice(null), 4000);
    }
  };

  const handleAddTiming = async (e) => {
    e.preventDefault();
    try {
      let response;
      if (editingTiming) {
        response = await api.put(`/vehicles/${id}/timings/${editingTiming.id}`, editingTiming);

        if (response.data.position_updated) {
          const positionUpdates = response.data.position_updates || [];
          const successfulUpdates = positionUpdates.filter(u => u.success);

          if (successfulUpdates.length > 0) {
            const originalError = error;
            setError(null);
            const circuitNames = successfulUpdates.map(u => u.circuit).join(', ');
            setTimingNotice({
              variant: 'success',
              message: `Posiciones actualizadas automáticamente en: ${circuitNames}`,
            });
            setTimeout(() => {
              setTimingNotice(null);
              setError(originalError);
            }, 5000);
          }
        }
      } else {
        const { id: _omit, ...timingToCreate } = newTiming;
        response = await api.post(`/vehicles/${id}/timings`, timingToCreate);

        if (response.data.position_updated) {
          setTimingNotice({
            variant: 'success',
            message: 'Nuevo tiempo registrado y posiciones actualizadas automáticamente',
          });
          setTimeout(() => {
            setTimingNotice(null);
          }, 5000);
        }
      }

      const reloadResponse = await api.get(`/vehicles/${id}/timings`);
      setTimings(reloadResponse.data);
      handleCancelEditTiming();
    } catch (error) {
      console.error('Error al guardar tiempo:', error);
      const backendError = error.response?.data?.error;
      const status = error.response?.status;
      if (status === 404 && editingTiming) {
        setError(backendError || 'El registro no fue encontrado (puede haber sido eliminado). Los datos se han conservado para que puedas añadirlo como nuevo.');
        const { id: _id, ...timingWithoutId } = editingTiming;
        setNewTiming({ ...timingWithoutId, circuit_id: editingTiming.circuit_id || '' });
        setEditingTiming(null);
      } else {
        setError(backendError || 'Error al guardar el tiempo');
      }
    }
  };

  const handleDeleteTiming = (timingId) => {
    setDeleteConfirm({ type: 'timing', timingId });
  };

  const confirmDeleteTiming = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'timing') return;
    const timingId = deleteConfirm.timingId;
    setDeleteConfirm(null);
    try {
      const response = await api.delete(`/vehicles/${id}/timings/${timingId}`);

      if (response.data.position_updated) {
        setTimingNotice({
          variant: 'success',
          message: `Tiempo eliminado y posiciones recalculadas en: ${response.data.circuit}`,
        });
        setTimeout(() => {
          setTimingNotice(null);
        }, 5000);
      }

      const reloadResponse = await api.get(`/vehicles/${id}/timings`);
      setTimings(reloadResponse.data);
    } catch (error) {
      console.error('Error al eliminar tiempo:', error);
      setError('Error al eliminar el registro de tiempo');
    }
  };

  const getTimingsByCircuitAndLane = () => {
    const grouped = {};

    timings.forEach(timing => {
      if (timing.circuit && timing.lane) {
        const key = `${timing.circuit}-${timing.lane}-${timing.laps || 'sin-vueltas'}`;
        if (!grouped[key]) {
          grouped[key] = {
            circuit: timing.circuit,
            lane: timing.lane,
            laps: timing.laps || 'N/A',
            timings: []
          };
        }
        grouped[key].timings.push(timing);
      }
    });

    return Object.values(grouped).filter(group => group.timings.length >= 2);
  };

  const renderSpecsForm = (isModificationTab = false) => {
    const currentSpec = isModificationTab ? technicalSpecs.modification : technicalSpecs.technical;
    const components = currentSpec?.components || [];
    const specValue = editingSpec || newSpec;
    const fromInventory = !editingSpec && selectedInventoryItemId && isModificationTab;

    return (
      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-lg font-semibold">
            {editingSpec ? 'Editar' : 'Añadir'} {isModificationTab ? 'Modificación' : 'Especificación Técnica'}
          </h4>
          {!editingSpec && isModificationTab && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setInventoryPickerOpen(true);
                loadInventoryForPicker();
              }}
            >
              <Package className="size-4 mr-2" aria-hidden />
              Desde inventario
            </Button>
          )}
        </div>
        {fromInventory && (
          <Alert>
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <span>
                  Usando ítem de inventario «{selectedInventoryItemName}». El tipo, nombre, referencia, enlace y precio los toma del ítem.
                  Al guardar se descontarán{' '}
                  {(() => {
                    const n = Math.min(
                      Math.max(1, parseInt(selectedInventoryMountQty, 10) || 1),
                      selectedInventoryMaxQty ?? 1,
                    );
                    return `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
                  })()}{' '}
                  del stock (máx. {selectedInventoryMaxQty ?? '—'}).
                </span>
                <Button type="button" variant="ghost" size="sm" className="shrink-0 self-start" onClick={clearInventoryLink}>
                  Quitar enlace
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                La cantidad se indica en el campo «Unidades» del formulario (debajo de marca). Ahí eliges cuántas se descuentan del stock y cuántas representa la pieza montada.
              </p>
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={e => handleAddSpec(e, isModificationTab)}>
          {editingSpec && isModificationTab && (
            <>
              <Alert className="mb-4">
                <Info className="size-4 shrink-0" aria-hidden />
                <AlertDescription>
                  Al guardar, el componente actual quedará registrado en el historial con la fecha indicada (si cambias algún dato respecto al que había). Puedes revisar los valores anteriores en esta misma pestaña y en el detalle del vehículo.
                </AlertDescription>
              </Alert>
              <div className="space-y-2 mb-4 max-w-xs">
                <Label htmlFor="change_effective_date">Fecha del cambio</Label>
                <Input
                  id="change_effective_date"
                  name="change_effective_date"
                  type="date"
                  value={specValue.change_effective_date || ''}
                  onChange={handleSpecChange}
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="component_type">Tipo de Componente</Label>
              {fromInventory ? (
                <Input
                  id="component_type"
                  readOnly
                  value={(() => {
                    const ct = specValue.component_type;
                    const lbl = getVehicleComponentTypeLabel(ct);
                    if (lbl !== '—') return lbl;
                    return formatInventoryCategory(ct === 'other' ? 'otro' : ct);
                  })()}
                  className="bg-muted"
                />
              ) : (
                <Select
                  value={specValue.component_type || 'none'}
                  onValueChange={(v) => handleSpecChange({ target: { name: 'component_type', value: v === 'none' ? '' : v, type: 'select', checked: false } })}
                  required
                >
                  <SelectTrigger id="component_type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar tipo</SelectItem>
                    {componentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="element">Elemento</Label>
              <Input
                id="element"
                name="element"
                value={specValue.element}
                onChange={handleSpecChange}
                required
                disabled={fromInventory}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Marca</Label>
              <Input
                id="manufacturer"
                name="manufacturer"
                value={specValue.manufacturer}
                onChange={handleSpecChange}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor={fromInventory ? 'inv-units-qty' : 'mounted_qty'}>
                {fromInventory ? 'Unidades (stock y montaje)' : 'Unidades montadas'}
              </Label>
              {fromInventory ? (
                <Input
                  id="inv-units-qty"
                  type="number"
                  min={1}
                  max={selectedInventoryMaxQty ?? undefined}
                  value={selectedInventoryMountQty}
                  onChange={(e) => setSelectedInventoryMountQty(e.target.value)}
                />
              ) : (
                <Input
                  id="mounted_qty"
                  name="mounted_qty"
                  type="number"
                  min={1}
                  value={specValue.mounted_qty ?? '1'}
                  onChange={handleSpecChange}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {fromInventory
                  ? `Se descontarán del inventario (máx. ${selectedInventoryMaxQty ?? '—'}) y quedarán como piezas montadas en esta línea.`
                  : 'Cuántas piezas iguales representa esta línea (p. ej. 2 para un par de neumáticos).'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="material">Material</Label>
              <Input id="material" name="material" value={specValue.material} onChange={handleSpecChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Tamaño</Label>
              <Input id="size" name="size" value={specValue.size} onChange={handleSpecChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input id="color" name="color" value={specValue.color} onChange={handleSpecChange} />
            </div>
          </div>
          {['pinion', 'crown'].includes(specValue.component_type) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="teeth">Dientes</Label>
                <Input id="teeth" name="teeth" type="number" value={specValue.teeth} onChange={handleSpecChange} required />
              </div>
            </div>
          )}
          {specValue.component_type === 'motor' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="rpm">RPM</Label>
                <Input id="rpm" name="rpm" type="number" value={specValue.rpm} onChange={handleSpecChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gaus">Gaus</Label>
                <Input id="gaus" name="gaus" type="number" value={specValue.gaus} onChange={handleSpecChange} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="price">{isModificationTab ? 'Precio unitario (€)' : 'Precio (€)'}</Label>
              <Input id="price" name="price" type="number" step="0.01" value={specValue.price} onChange={handleSpecChange} disabled={fromInventory} />
              {isModificationTab && (
                <p className="text-xs text-muted-foreground">
                  Por unidad; el coste en el coche es precio × unidades montadas.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" name="url" type="url" value={specValue.url} onChange={handleSpecChange} disabled={fromInventory} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" value={specValue.sku} onChange={handleSpecChange} disabled={fromInventory} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={3} value={specValue.description} onChange={handleSpecChange} />
          </div>
          {!isModificationTab && (
            <div className="flex items-center space-x-2 mt-4">
              <Switch
                id="is_modification"
                checked={specValue.is_modification}
                onCheckedChange={(checked) => handleSpecChange({ target: { name: 'is_modification', value: '', type: 'checkbox', checked } })}
              />
              <Label htmlFor="is_modification">Es una modificación</Label>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button type="submit">
              {fromInventory
                ? 'Montar y descontar stock'
                : `${editingSpec ? 'Actualizar' : 'Añadir'} ${isModificationTab ? 'Modificación' : 'Especificación'}`}
            </Button>
            {editingSpec && (
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
        {isModificationTab && (
          <Dialog open={inventoryPickerOpen} onOpenChange={(open) => setInventoryPickerOpen(open)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Elegir ítem de inventario</DialogTitle>
                <DialogDescription>
                  Solo se muestran piezas con stock. Si eliges un tipo de componente arriba, la lista se filtra por esa categoría.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2">
                {inventoryPickerLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="size-8" />
                  </div>
                ) : inventoryPickerItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No hay ítems con stock{newSpec.component_type ? ' para esta categoría' : ''}.
                  </p>
                ) : (
                  inventoryPickerItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatInventoryCategory(item.category)} · Stock: {item.quantity}
                          {item.purchase_price != null &&
                            ` · ${Number(item.purchase_price).toFixed(2)} €/ud (precio unitario)`}
                        </p>
                      </div>
                      <Button type="button" size="sm" className="shrink-0" onClick={() => handlePickInventoryItem(item)}>
                        Usar este
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInventoryPickerOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">{isModificationTab ? 'Modificaciones Actuales' : 'Especificaciones Técnicas Actuales'}</h4>
          {loadingSpecs ? (
            <Spinner className="size-6" />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Elemento</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>P. unit.</TableHead>
                    <TableHead>Total línea</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground">
                        No hay {isModificationTab ? 'modificaciones' : 'especificaciones técnicas'}
                      </TableCell>
                    </TableRow>
                  )}
                  {components.map((comp) => (
                    <React.Fragment key={comp.id}>
                      <TableRow>
                        <TableCell>{getVehicleComponentTypeLabel(comp.component_type)}</TableCell>
                        <TableCell>{comp.element}</TableCell>
                        <TableCell>{comp.mounted_qty ?? 1}</TableCell>
                        <TableCell>{comp.manufacturer}</TableCell>
                        <TableCell>{comp.material}</TableCell>
                        <TableCell>{comp.size}</TableCell>
                        <TableCell>{comp.color}</TableCell>
                        <TableCell>{comp.price != null && comp.price !== '' ? `€${Number(comp.price).toFixed(2)}` : '-'}</TableCell>
                        <TableCell>
                          {comp.price != null && comp.price !== ''
                            ? `€${modificationLineTotal(comp.price, comp.mounted_qty).toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {comp.url ? (
                            <a href={comp.url} target="_blank" rel="noopener noreferrer" title="Abrir enlace" className="text-primary hover:underline">
                              <ExternalLink className="size-4 inline" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="default" size="sm" onClick={() => handleEditSpec(currentSpec, comp)} title="Editar">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteSpec(currentSpec.id, comp.id)} title="Eliminar">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isModificationTab && comp.change_history?.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-muted/40 align-top py-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Historial (componente anterior)</p>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                              {comp.change_history.map((h) => (
                                <li key={h.id}>
                                  <span className="text-muted-foreground">Desde el {formatHistoryDate(h.effective_date)}: </span>
                                  {formatModificationSnapshot(h.previous_snapshot)}
                                </li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                  {isModificationTab && components.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-right font-bold">
                        Total modificaciones
                      </TableCell>
                      <TableCell className="font-bold">—</TableCell>
                      <TableCell className="font-bold">
                        €
                        {components
                          .reduce((sum, comp) => sum + modificationLineTotal(comp.price, comp.mounted_qty), 0)
                          .toFixed(2)}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTimingsForm = () => {
    return (
      <div className="mt-4 space-y-4">
        <h4 className="text-lg font-semibold">{editingTiming ? 'Editar' : 'Añadir'} Registro de Tiempo</h4>
        {timingNotice && (
          <Alert
            className={cn(
              'mb-4 flex items-start gap-2',
              timingNotice.variant === 'success'
                ? 'border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200'
                : 'border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
            )}
          >
            {timingNotice.variant === 'success' ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{timingNotice.message}</span>
          </Alert>
        )}
        <form onSubmit={handleAddTiming}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="best_lap_time">Mejor Vuelta (mm:ss.ms)</Label>
              <Input
                id="best_lap_time"
                name="best_lap_time"
                value={editingTiming?.best_lap_time || newTiming.best_lap_time}
                onChange={handleTimingChange}
                placeholder="00:00.000"
                pattern="\d{2}:\d{2}\.\d{3}"
                title="Formato: mm:ss.ms (ejemplo: 01:23.456)"
                required
              />
              <p className="text-xs text-muted-foreground">Formato: mm:ss.ms (ejemplo: 01:23.456)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_time">Tiempo Total (mm:ss.ms)</Label>
              <Input
                id="total_time"
                name="total_time"
                value={editingTiming?.total_time || newTiming.total_time}
                onChange={handleTimingChange}
                placeholder="00:00.000"
                pattern="\d{2}:\d{2}\.\d{3}"
                title="Formato: mm:ss.ms (ejemplo: 01:23.456)"
                required
              />
              <p className="text-xs text-muted-foreground">Formato: mm:ss.ms (ejemplo: 01:23.456)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="laps">Vueltas</Label>
              <Input
                id="laps"
                name="laps"
                type="number"
                value={editingTiming?.laps || newTiming.laps}
                onChange={handleTimingChange}
                required
                min="1"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="average_time">Tiempo Promedio (mm:ss.ms)</Label>
              <Input
                id="average_time"
                name="average_time"
                value={editingTiming?.average_time || newTiming.average_time}
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Calculado automáticamente</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lane">Carril</Label>
              <Input id="lane" name="lane" value={editingTiming?.lane || newTiming.lane} onChange={handleTimingChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timing_date">Fecha</Label>
              <Input
                id="timing_date"
                name="timing_date"
                type="date"
                value={editingTiming?.timing_date || newTiming.timing_date}
                onChange={handleTimingChange}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="circuit_id">Circuito</Label>
              <Select
                value={(editingTiming?.circuit_id || newTiming.circuit_id) || 'none'}
                onValueChange={(v) => {
                  const t = editingTiming || newTiming;
                  const fn = editingTiming ? setEditingTiming : setNewTiming;
                  fn({ ...t, circuit_id: v === 'none' ? '' : v });
                }}
              >
                <SelectTrigger id="circuit_id">
                  <SelectValue placeholder="Seleccionar circuito (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {circuits.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supply_voltage_volts">Voltaje pista (V)</Label>
              <Input
                id="supply_voltage_volts"
                name="supply_voltage_volts"
                value={editingTiming?.supply_voltage_volts ?? newTiming.supply_voltage_volts ?? ''}
                onChange={handleTimingChange}
                placeholder="Opcional, 0–30"
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">También puedes editarlo en la tabla de registros.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="submit">
              {editingTiming ? 'Actualizar' : 'Añadir'} Registro
            </Button>
            {editingTiming && (
              <Button type="button" variant="secondary" onClick={handleCancelEditTiming}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
        <div className="mt-6">
          <h4 className="text-lg font-semibold mb-4">Registros de Tiempo</h4>
          {loadingTimings ? (
            <Spinner className="size-6" />
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Mejor Vuelta</TableHead>
                      <TableHead>Tiempo Total</TableHead>
                      <TableHead>Vueltas</TableHead>
                      <TableHead>Tiempo Promedio</TableHead>
                      <TableHead>Distancia</TableHead>
                      <TableHead>Velocidad</TableHead>
                      <TableHead>Carril</TableHead>
                      <TableHead>Circuito</TableHead>
                      <TableHead className="w-[100px]">V (V)</TableHead>
                      <TableHead className="text-center">Configuración</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground">No hay registros de tiempo</TableCell>
                      </TableRow>
                    )}
                    {timings.map((timing) => (
                      <TableRow key={timing.id}>
                        <TableCell>{new Date(timing.timing_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono">{timing.best_lap_time}</TableCell>
                        <TableCell className="font-mono">{timing.total_time}</TableCell>
                        <TableCell>{timing.laps}</TableCell>
                        <TableCell className="font-mono">{timing.average_time}</TableCell>
                        <TableCell>
                          {formatDistance(timing.total_distance_meters)}
                        </TableCell>
                        <TableCell>
                          {timing.avg_speed_kmh != null && timing.avg_speed_scale_kmh != null
                            ? `${Number(timing.avg_speed_kmh).toFixed(1)} km/h (${Number(timing.avg_speed_scale_kmh).toFixed(0)} eq.)`
                            : '-'}
                        </TableCell>
                        <TableCell>{timing.lane || '-'}</TableCell>
                        <TableCell>{timing.circuit || '-'}</TableCell>
                        <TableCell>
                          <Input
                            key={`v-${timing.id}-${timing.supply_voltage_volts ?? ''}`}
                            className="h-8 font-mono text-xs px-2"
                            defaultValue={timing.supply_voltage_volts != null && timing.supply_voltage_volts !== '' ? String(timing.supply_voltage_volts) : ''}
                            placeholder="—"
                            inputMode="decimal"
                            onBlur={(e) => handleTimingVoltageBlur(timing.id, e.target.value)}
                            aria-label="Voltaje de la sesión en voltios"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {timing.setup_snapshot ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTiming(timing);
                                setShowSpecsModal(true);
                              }}
                              title="Ver especificaciones técnicas"
                            >
                              <Wrench className="size-4 mr-1" />
                              Ver Config
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sin config</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {timingHasLaps[timing.id] && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setPerformanceTiming(timing); setShowPerformanceModal(true); }}
                                title="Ver análisis de rendimiento"
                              >
                                <BarChart3 className="size-4" />
                              </Button>
                            )}
                            <Button variant="default" size="sm" onClick={() => handleEditTiming(timing)} title="Editar">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteTiming(timing.id)} title="Eliminar">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {timings.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-lg font-semibold mb-4">Evolución de Tiempos por Circuito y Carril</h4>
                  <p className="text-muted-foreground mb-4">
                    Se muestran gráficas de evolución para circuitos y carriles con múltiples registros de tiempo.
                  </p>

                  {(() => {
                    const groupedTimings = getTimingsByCircuitAndLane();
                    if (groupedTimings.length === 0) {
                      return (
                        <div className="text-center text-muted-foreground py-8">
                          <p>No hay suficientes registros de tiempo para mostrar evolución.</p>
                          <p className="text-sm mt-1">Se necesitan al menos 2 registros del mismo circuito y carril.</p>
                        </div>
                      );
                    }

                    return groupedTimings.map((group) => (
                      <React.Fragment key={`${group.circuit}-${group.lane}-${group.laps}`}>
                        <TimingEvolutionChart
                          timings={group.timings}
                          circuit={group.circuit}
                          lane={group.lane}
                          laps={group.laps}
                        />
                        <SpeedEvolutionChart
                          timings={group.timings}
                          circuit={group.circuit}
                          lane={group.lane}
                          laps={group.laps}
                        />
                      </React.Fragment>
                    ));
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading || !vehicle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <Alert variant="destructive">{error}</Alert>
      </div>
    );
  }

  const vehicleTabOptions = [
    { value: 'general', label: 'Información General' },
    { value: 'technical', label: 'Especificaciones Técnicas' },
    { value: 'modifications', label: 'Modificaciones' },
    { value: 'timings', label: 'Tabla de Tiempos' },
    ...(hasMultipleConfigs(timings) ? [{ value: 'config-analysis', label: 'Análisis Config.' }] : []),
    { value: 'maintenance', label: 'Mantenimiento' },
  ];

  const vehicleTabsTriggerClass = 'sm:px-3 sm:text-sm';

  const getConfirmDialogContent = () => {
    if (!deleteConfirm) return null;
    if (deleteConfirm.type === 'image') {
      return {
        title: '¿Eliminar imagen?',
        description: '¿Estás seguro de que quieres eliminar esta imagen? Esta acción no se puede deshacer.',
        extra: null,
        onConfirm: confirmDeleteImage,
      };
    }
    if (deleteConfirm.type === 'spec') {
      return {
        title: deleteConfirm.isModification ? '¿Eliminar modificación?' : '¿Eliminar especificación?',
        description: deleteConfirm.isModification
          ? `¿Eliminar «${deleteConfirm.elementLabel || 'esta pieza'}»? La línea desaparecerá del listado.`
          : '¿Estás seguro de que quieres eliminar esta especificación? Esta acción no se puede deshacer.',
        extra: deleteConfirm.isModification ? (
          <div className="flex items-start gap-2 pt-4">
            <Switch
              id="spec-del-inv"
              checked={specDeleteReturnToInventory}
              onCheckedChange={setSpecDeleteReturnToInventory}
            />
            <Label htmlFor="spec-del-inv" className="text-sm font-normal leading-snug cursor-pointer">
              Añadir al inventario la pieza retirada ({deleteConfirm.mountedQty}{' '}
              {deleteConfirm.mountedQty === 1 ? 'unidad' : 'unidades'})
            </Label>
          </div>
        ) : null,
        onConfirm: confirmDeleteSpec,
      };
    }
    if (deleteConfirm.type === 'timing') {
      return {
        title: '¿Eliminar registro de tiempo?',
        description: '¿Estás seguro de que quieres eliminar este registro de tiempo? Esta acción no se puede deshacer.',
        extra: null,
        onConfirm: confirmDeleteTiming,
      };
    }
    return null;
  };

  const confirmContent = getConfirmDialogContent();

  return (
    <>
      <AlertDialog
        open={specReturnDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelModificationReturnDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Añadir al inventario la pieza retirada?</AlertDialogTitle>
            <AlertDialogDescription>
              Has modificado esta línea de modificación; la configuración anterior queda registrada en el historial.
              {pendingSpecSave != null && (
                <>
                  {' '}
                  ¿Quieres crear un ítem en inventario por las{' '}
                  <strong>{pendingSpecSave.removedQty}</strong>{' '}
                  {pendingSpecSave.removedQty === 1 ? 'unidad retirada' : 'unidades retiradas'} (estado previo al
                  cambio)?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel type="button">Cancelar edición</AlertDialogCancel>
            <Button type="button" variant="secondary" onClick={() => resolveModificationReturnChoice(false)}>
              No, solo guardar
            </Button>
            <Button type="button" onClick={() => resolveModificationReturnChoice(true)}>
              Sí, al inventario
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {confirmContent && (
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmContent.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmContent.description}</AlertDialogDescription>
            </AlertDialogHeader>
            {confirmContent.extra}
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
              <AlertDialogAction type="button" onClick={confirmContent.onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="container mt-4">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Editar Vehículo{vehicle.model ? `: ${vehicle.model}` : ''}</h2>
          {vehicle.total_distance_meters != null && vehicle.total_distance_meters > 0 && (
            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
              Odómetro: {formatDistance(vehicle.total_distance_meters)}
            </span>
          )}
        </div>
        <Button variant="secondary" onClick={() => navigate('/vehicles')}>
          Volver al listado
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-6 sm:hidden">
          <div
            className={cn(
              'rounded-xl border-2 border-primary/25 bg-muted/50 p-4 shadow-sm',
              'ring-1 ring-border/60',
            )}
          >
            <div className="mb-3 flex items-center gap-2 border-b border-border/80 pb-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <LayoutPanelLeft className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Navegación
                </p>
                <p className="text-sm font-medium leading-tight text-foreground">Sección del vehículo</p>
              </div>
            </div>
            <Label htmlFor="vehicle-edit-section" className="sr-only">
              Sección del vehículo
            </Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger
                id="vehicle-edit-section"
                className="h-11 w-full border-2 border-input bg-background text-base font-medium shadow-sm"
              >
                <SelectValue placeholder="Elige una sección" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[min(24rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)]">
                {vehicleTabOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <TabsList
          className={cn(
            'mb-4 hidden h-auto min-h-9 w-full gap-1 sm:grid',
            hasMultipleConfigs(timings)
              ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
              : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
          )}
        >
          <TabsTrigger value="general" className={vehicleTabsTriggerClass}>
            Información General
          </TabsTrigger>
          <TabsTrigger value="technical" className={vehicleTabsTriggerClass}>
            Especificaciones Técnicas
          </TabsTrigger>
          <TabsTrigger value="modifications" className={vehicleTabsTriggerClass}>
            Modificaciones
          </TabsTrigger>
          <TabsTrigger value="timings" className={vehicleTabsTriggerClass}>
            Tabla de Tiempos
          </TabsTrigger>
          {hasMultipleConfigs(timings) && (
            <TabsTrigger value="config-analysis" className={vehicleTabsTriggerClass}>
              Análisis Config.
            </TabsTrigger>
          )}
          <TabsTrigger value="maintenance" className={vehicleTabsTriggerClass}>
            Mantenimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input id="model" name="model" value={vehicle.model || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Referencia</Label>
                  <Input id="reference" name="reference" value={vehicle.reference ?? ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Fabricante</Label>
                  <Input id="manufacturer" name="manufacturer" value={vehicle.manufacturer || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={vehicle.type || 'none'} onValueChange={(v) => handleChange({ target: { name: 'type', value: v === 'none' ? '' : v, type: 'select', checked: false } })} required>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecciona tipo</SelectItem>
                      {vehicleTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="traction">Tracción</Label>
                  <Input id="traction" name="traction" value={vehicle.traction || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Precio original (€)</Label>
                  <Input id="price" name="price" type="number" step="0.01" value={vehicle.price || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Fecha de compra</Label>
                  <Input id="purchase_date" name="purchase_date" type="date" value={vehicle.purchase_date ? vehicle.purchase_date.substring(0, 10) : ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_place">Lugar de compra</Label>
                  <Input id="purchase_place" name="purchase_place" value={vehicle.purchase_place ?? ''} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="modified" checked={!!vehicle.modified} onCheckedChange={(checked) => handleChange({ target: { name: 'modified', type: 'checkbox', checked } })} />
                    <Label htmlFor="modified">Modificado</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="digital" checked={!!vehicle.digital} onCheckedChange={(checked) => handleChange({ target: { name: 'digital', type: 'checkbox', checked } })} />
                    <Label htmlFor="digital">Digital</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="museo" checked={!!vehicle.museo} onCheckedChange={(checked) => handleChange({ target: { name: 'museo', type: 'checkbox', checked } })} />
                    <Label htmlFor="museo">Museo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="taller" checked={!!vehicle.taller} onCheckedChange={(checked) => handleChange({ target: { name: 'taller', type: 'checkbox', checked } })} />
                    <Label htmlFor="taller">Taller</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anotaciones">Anotaciones</Label>
                  <Textarea id="anotaciones" name="anotaciones" rows={3} value={vehicle.anotaciones ?? ''} onChange={handleChange} placeholder="Añade tus comentarios..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scale_factor">Escala (1:X)</Label>
                  <Input
                    id="scale_factor"
                    name="scale_factor"
                    type="number"
                    min="1"
                    max="100"
                    value={vehicle.scale_factor ?? 32}
                    onChange={handleChange}
                    placeholder="32"
                  />
                  <p className="text-xs text-muted-foreground">Escala del coche para calcular velocidad equivalente (ej: 32 = 1:32, 43 = 1:43)</p>
                </div>
              </div>
              <div>
                <h5 className="text-lg font-semibold mb-4">Fotografías</h5>
                <div className="grid grid-cols-2 gap-4">
                  {imageFields.map(({ name, label }) => (
                    <div key={name} className="space-y-2">
                      <Label>{label} Imagen</Label>
                      <div
                        className={cn(
                          'border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 relative min-h-[120px] cursor-pointer transition-colors',
                          draggingOver === name ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 bg-muted/30 hover:bg-muted/50'
                        )}
                        onClick={() => document.getElementById(`img-${name}`).click()}
                        onDragEnter={(e) => handleDragEnter(e, name)}
                        onDragLeave={(e) => handleDragLeave(e, name)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, name)}
                      >
                        {previews[name] || images[name] ? (
                          <>
                            <img
                              ref={el => imageRefs.current[name] = el}
                              src={previews[name] || URL.createObjectURL(images[name])}
                              alt={label}
                              className="max-w-full max-h-[90px] object-contain pointer-events-none"
                              loading="lazy"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 z-10"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteImage(name);
                              }}
                              disabled={deletingImage === name}
                            >
                              {deletingImage === name ? (
                                <Spinner className="size-4" />
                              ) : (
                                '×'
                              )}
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {draggingOver === name ? 'Suelta la imagen aquí' : 'Arrastra o haz clic'}
                          </span>
                        )}
                        <input
                          id={`img-${name}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleImageChange(e, name)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {error && (
              <Alert variant="destructive" className="mt-4">
                {error}
              </Alert>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" type="button" onClick={() => navigate('/vehicles')}>
                Cancelar
              </Button>
              <Button type="submit" name="save-vehicle" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Actualizar'
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="technical">
          {renderSpecsForm(false)}
        </TabsContent>

        <TabsContent value="modifications">
          {renderSpecsForm(true)}
        </TabsContent>

        <TabsContent value="timings">
          {renderTimingsForm()}
        </TabsContent>
        {hasMultipleConfigs(timings) && (
          <TabsContent value="config-analysis">
            <SetupPerformanceAnalysis timings={timings} />
          </TabsContent>
        )}
        <TabsContent value="maintenance">
          <MaintenanceCorrelationChart timings={timings} maintenanceLogs={maintenanceLogs} />
          <MaintenanceLog vehicleId={id} onLogsChange={setMaintenanceLogs} />
        </TabsContent>
      </Tabs>

      <TimingSpecsModal
        show={showSpecsModal}
        onHide={() => setShowSpecsModal(false)}
        setupSnapshot={selectedTiming?.setup_snapshot}
        timing={selectedTiming}
      />
      <SessionPerformanceModal
        show={showPerformanceModal}
        onHide={() => setShowPerformanceModal(false)}
        timing={performanceTiming}
        vehicle={vehicle}
      />
    </div>
    </>
  );
};

export default EditVehicle;
