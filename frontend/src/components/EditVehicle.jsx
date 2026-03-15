import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2, Wrench } from 'lucide-react';
import api from '../lib/axios';
import TimingEvolutionChart from './charts/TimingEvolutionChart';
import TimingSpecsModal from './TimingSpecsModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Alert } from './ui/alert';
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

const componentTypes = [
  { value: 'pinion', label: 'Piñón' },
  { value: 'crown', label: 'Corona' },
  { value: 'front_wheel', label: 'Rueda Delantera' },
  { value: 'rear_wheel', label: 'Rueda Trasera' },
  { value: 'front_rim', label: 'Llanta Delantera' },
  { value: 'rear_rim', label: 'Llanta Trasera' },
  { value: 'chassis', label: 'Chasis' },
  { value: 'other', label: 'Otros' },
  { value: 'rear_axle', label: 'Eje Trasero' },
  { value: 'front_axle', label: 'Eje Delantero' },
  { value: 'guide', label: 'Guía' },
  { value: 'motor', label: 'Motor' },
];

const vehicleTypes = ['Rally', 'GT', 'LMP', 'Clásico', 'DTM', 'F1', 'Camiones', 'Raid'];

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
    average_time_timestamp: null
  });
  const [loadingTimings, setLoadingTimings] = useState(false);
  const [timingWarning, setTimingWarning] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [selectedTiming, setSelectedTiming] = useState(null);

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
        const specs = {
          modification: response.data.find(spec => spec.is_modification),
          technical: response.data.find(spec => !spec.is_modification)
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

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setVehicle({
      ...vehicle,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleImageChange = (e, field) => {
    const file = e.target.files[0];
    setImages({ ...images, [field]: file });
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        requestAnimationFrame(() => {
          setPreviews(prev => ({ ...prev, [field]: reader.result }));
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteImage = async (viewType) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta imagen?')) {
      return;
    }

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
    setEditingSpec({
      id: spec.id,
      component_id: component.id,
      component_type: component.component_type || '',
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
      is_modification: spec.is_modification
    });
  };

  const handleCancelEdit = () => {
    setEditingSpec(null);
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
      is_modification: false
    });
  };

  const handleAddSpec = async (e, isModificationTab = false) => {
    e.preventDefault();
    const compType = editingSpec?.component_type || newSpec.component_type;
    if (!compType) {
      setError('El tipo de componente es requerido');
      return;
    }
    try {
      const specData = {
        is_modification: isModificationTab,
        component_id: editingSpec?.component_id,
        components: [
          {
            component_type: (editingSpec?.component_type || newSpec.component_type),
            element: (editingSpec?.element || newSpec.element),
            manufacturer: (editingSpec?.manufacturer || newSpec.manufacturer),
            material: (editingSpec?.material || newSpec.material),
            size: (editingSpec?.size || newSpec.size),
            teeth: (editingSpec?.teeth || newSpec.teeth) === '' ? null : Number(editingSpec?.teeth || newSpec.teeth),
            color: (editingSpec?.color || newSpec.color),
            rpm: (editingSpec?.rpm || newSpec.rpm) === '' ? null : Number(editingSpec?.rpm || newSpec.rpm),
            gaus: (editingSpec?.gaus || newSpec.gaus) === '' ? null : Number(editingSpec?.gaus || newSpec.gaus),
            price: (editingSpec?.price || newSpec.price) === '' ? null : Number(editingSpec?.price || newSpec.price),
            url: (editingSpec?.url || newSpec.url),
            sku: (editingSpec?.sku || newSpec.sku),
            description: (editingSpec?.description || newSpec.description)
          }
        ]
      };

      if (editingSpec) {
        const currentSpec = isModificationTab ? technicalSpecs.modification : technicalSpecs.technical;
        await api.put(`/vehicles/${id}/technical-specs/${currentSpec.id}/components/${editingSpec.component_id}`, specData);
      } else {
        await api.post(`/vehicles/${id}/technical-specs`, specData);
      }

      const response = await api.get(`/vehicles/${id}/technical-specs`);
      const updatedSpecs = {
        modification: response.data.find(spec => spec.is_modification),
        technical: response.data.find(spec => !spec.is_modification)
      };
      setTechnicalSpecs(updatedSpecs);
      handleCancelEdit();
    } catch (error) {
      console.error('Error al guardar especificación:', error);
      setError('Error al guardar la especificación técnica');
    }
  };

  const handleDeleteSpec = async (specId, componentId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta especificación?')) {
      return;
    }

    try {
      await api.delete(`/vehicles/${id}/technical-specs/${specId}/components/${componentId}`);
      const response = await api.get(`/vehicles/${id}/technical-specs`);
      const updatedSpecs = {
        modification: response.data.find(spec => spec.is_modification),
        technical: response.data.find(spec => !spec.is_modification)
      };
      setTechnicalSpecs(updatedSpecs);
    } catch (error) {
      console.error('Error al eliminar especificación:', error);
      setError('Error al eliminar la especificación técnica');
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
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
      setTimingWarning(`⚠️ El tiempo total (${totalTime}) es menor que el mínimo posible (${minimumTime}) para ${laps} vueltas con mejor vuelta de ${bestLapTime}`);
    } else {
      setTimingWarning(null);
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
      [`${name}_timestamp`]: timestamp
    };

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
      average_time_timestamp: average_time_timestamp || timing.average_time_timestamp
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
      average_time_timestamp: null
    });
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
            const successMessage = `✅ Posiciones actualizadas automáticamente en: ${circuitNames}`;
            setTimingWarning(successMessage);
            setTimeout(() => {
              setTimingWarning(null);
              setError(originalError);
            }, 5000);
          }
        }
      } else {
        response = await api.post(`/vehicles/${id}/timings`, newTiming);

        if (response.data.position_updated) {
          setTimingWarning('✅ Nuevo tiempo registrado y posiciones actualizadas automáticamente');
          setTimeout(() => {
            setTimingWarning(null);
          }, 5000);
        }
      }

      const reloadResponse = await api.get(`/vehicles/${id}/timings`);
      setTimings(reloadResponse.data);
      handleCancelEditTiming();
    } catch (error) {
      console.error('Error al guardar tiempo:', error);
      setError('Error al guardar el tiempo');
    }
  };

  const handleDeleteTiming = async (timingId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este registro de tiempo?')) {
      return;
    }

    try {
      const response = await api.delete(`/vehicles/${id}/timings/${timingId}`);

      if (response.data.position_updated) {
        setTimingWarning(`✅ Tiempo eliminado y posiciones recalculadas en: ${response.data.circuit}`);
        setTimeout(() => {
          setTimingWarning(null);
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

    return (
      <div className="mt-4 space-y-4">
        <h4 className="text-lg font-semibold">{editingSpec ? 'Editar' : 'Añadir'} {isModificationTab ? 'Modificación' : 'Especificación Técnica'}</h4>
        <form onSubmit={e => handleAddSpec(e, isModificationTab)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="component_type">Tipo de Componente</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="element">Elemento</Label>
              <Input
                id="element"
                name="element"
                value={specValue.element}
                onChange={handleSpecChange}
                required
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
              <Label htmlFor="price">Precio (€)</Label>
              <Input id="price" name="price" type="number" step="0.01" value={specValue.price} onChange={handleSpecChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" name="url" type="url" value={specValue.url} onChange={handleSpecChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" value={specValue.sku} onChange={handleSpecChange} />
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
              {editingSpec ? 'Actualizar' : 'Añadir'} {isModificationTab ? 'Modificación' : 'Especificación'}
            </Button>
            {editingSpec && (
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
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
                    <TableHead>Marca</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No hay {isModificationTab ? 'modificaciones' : 'especificaciones técnicas'}
                      </TableCell>
                    </TableRow>
                  )}
                  {components.map((comp, idx) => (
                    <TableRow key={currentSpec.id + '-' + idx}>
                      <TableCell>{componentTypes.find(t => t.value === comp.component_type)?.label || comp.component_type}</TableCell>
                      <TableCell>{comp.element}</TableCell>
                      <TableCell>{comp.manufacturer}</TableCell>
                      <TableCell>{comp.material}</TableCell>
                      <TableCell>{comp.size}</TableCell>
                      <TableCell>{comp.color}</TableCell>
                      <TableCell>{comp.price ? `€${Number(comp.price).toFixed(2)}` : '-'}</TableCell>
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
                  ))}
                  {isModificationTab && components.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-right font-bold">Total modificaciones</TableCell>
                      <TableCell className="font-bold">
                        €{components.reduce((sum, comp) => sum + (comp.price ? Number(comp.price) : 0), 0).toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
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
        {timingWarning && (
          <Alert
            className={cn(
              "mb-4",
              timingWarning.includes('✅') ? "border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200" : "border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            )}
          >
            {timingWarning}
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
                      <TableHead>Carril</TableHead>
                      <TableHead>Circuito</TableHead>
                      <TableHead className="text-center">Configuración</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">No hay registros de tiempo</TableCell>
                      </TableRow>
                    )}
                    {timings.map((timing) => (
                      <TableRow key={timing.id}>
                        <TableCell>{new Date(timing.timing_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono">{timing.best_lap_time}</TableCell>
                        <TableCell className="font-mono">{timing.total_time}</TableCell>
                        <TableCell>{timing.laps}</TableCell>
                        <TableCell className="font-mono">{timing.average_time}</TableCell>
                        <TableCell>{timing.lane || '-'}</TableCell>
                        <TableCell>{timing.circuit || '-'}</TableCell>
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
                      <TimingEvolutionChart
                        key={`${group.circuit}-${group.lane}-${group.laps}`}
                        timings={group.timings}
                        circuit={group.circuit}
                        lane={group.lane}
                        laps={group.laps}
                      />
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

  return (
    <div className="container mt-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Editar Vehículo{vehicle.model ? `: ${vehicle.model}` : ''}</h2>
        <Button variant="secondary" onClick={() => navigate('/vehicles')}>
          Volver al listado
        </Button>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="general">Información General</TabsTrigger>
          <TabsTrigger value="technical">Especificaciones Técnicas</TabsTrigger>
          <TabsTrigger value="modifications">Modificaciones</TabsTrigger>
          <TabsTrigger value="timings">Tabla de Tiempos</TabsTrigger>
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
                  <Input id="reference" name="reference" value={vehicle.reference || ''} onChange={handleChange} />
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
                  <Input id="purchase_place" name="purchase_place" value={vehicle.purchase_place || ''} onChange={handleChange} />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="modified" checked={!!vehicle.modified} onCheckedChange={(checked) => handleChange({ target: { name: 'modified', type: 'checkbox', checked } })} />
                  <Label htmlFor="modified">Modificado</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="digital" checked={!!vehicle.digital} onCheckedChange={(checked) => handleChange({ target: { name: 'digital', type: 'checkbox', checked } })} />
                  <Label htmlFor="digital">Digital</Label>
                </div>
              </div>
              <div>
                <h5 className="text-lg font-semibold mb-4">Fotografías</h5>
                <div className="grid grid-cols-2 gap-4">
                  {imageFields.map(({ name, label }) => (
                    <div key={name} className="space-y-2">
                      <Label>{label} Imagen</Label>
                      <div
                        className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 relative min-h-[120px] cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                        onClick={(e) => {
                          if (!previews[name] && !images[name]) {
                            document.getElementById(`img-${name}`).click();
                          }
                        }}
                      >
                        {previews[name] || images[name] ? (
                          <>
                            <img
                              ref={el => imageRefs.current[name] = el}
                              src={previews[name] || URL.createObjectURL(images[name])}
                              alt={label}
                              className="max-w-full max-h-[90px] object-contain"
                              loading="lazy"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1"
                              onClick={(e) => {
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
                          <span className="text-muted-foreground">Imagen</span>
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
              <Button type="submit" disabled={saving}>
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
      </Tabs>

      <TimingSpecsModal
        show={showSpecsModal}
        onHide={() => setShowSpecsModal(false)}
        setupSnapshot={selectedTiming?.setup_snapshot}
        timing={selectedTiming}
      />
    </div>
  );
};

export default EditVehicle;
