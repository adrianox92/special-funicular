import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Alert, Row, Col, Spinner, Nav, Tab } from 'react-bootstrap';
import api from '../lib/axios';
import { FiExternalLink } from 'react-icons/fi';
import TimingEvolutionChart from './charts/TimingEvolutionChart';
import TimingSpecsModal from './TimingSpecsModal';

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
  // También permitir los nombres internos por si ya están bien
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
  const [newTiming, setNewTiming] = useState({
    best_lap_time: '',
    total_time: '',
    laps: '',
    average_time: '',
    lane: '',
    circuit: '',
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
    api.get(`/vehicles/${id}`)
      .then(async res => {
        setVehicle(res.data);
        // Obtener imágenes del vehículo
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
          // Cancelar el timeout anterior si existe
          if (timeouts.has(key)) {
            cancelAnimationFrame(timeouts.get(key));
          }
          
          // Usar requestAnimationFrame para limitar las actualizaciones
          const timeoutId = requestAnimationFrame(() => {
            if (!Array.isArray(entries) || !entries.length) {
              return;
            }
            // Aquí podríamos hacer algo con el tamaño si fuera necesario
          });
          
          timeouts.set(key, timeoutId);
        });
        
        observer.observe(element);
        observers.set(key, observer);
      }
    };

    // Configurar observadores para cada imagen
    Object.keys(imageRefs.current).forEach(key => {
      if (imageRefs.current[key]) {
        setupResizeObserver(imageRefs.current[key], key);
      }
    });

    return () => {
      // Limpiar timeouts y observadores
      timeouts.forEach(timeoutId => {
        if (timeoutId) {
          cancelAnimationFrame(timeoutId);
        }
      });
      observers.forEach(observer => observer.disconnect());
    };
  }, [previews, images]);

  useEffect(() => {
    // Cargar especificaciones técnicas
    const loadTechnicalSpecs = async () => {
      setLoadingSpecs(true);
      try {
        const response = await api.get(`/vehicles/${id}/technical-specs`);
        // Organizar las especificaciones por tipo
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
    // Cargar tiempos
    const loadTimings = async () => {
      try {
        setLoadingTimings(true);
        const response = await api.get(`/vehicles/${id}/timings`);
        
        // Recalcular promedios para cada tiempo
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
      // Actualizar ambos estados
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
    const targetSpec = editingSpec || newSpec;
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

      // Recargar especificaciones técnicas
      const response = await api.get(`/vehicles/${id}/technical-specs`);
      const updatedSpecs = {
        modification: response.data.find(spec => spec.is_modification),
        technical: response.data.find(spec => !spec.is_modification)
      };
      setTechnicalSpecs(updatedSpecs);
      
      // Limpiar el formulario
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
      // Recargar especificaciones técnicas
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
      
      // Procesar los datos antes de enviarlos
      const processedVehicle = {
        ...vehicle,
        // Convertir valores numéricos vacíos o nulos a undefined
        price: vehicle.price === '' || vehicle.price === null ? undefined : Number(vehicle.price),
        total_price: vehicle.total_price === '' || vehicle.total_price === null ? undefined : Number(vehicle.total_price)
      };

      // Añadir los datos procesados al FormData
      Object.entries(processedVehicle).forEach(([key, value]) => {
        // Solo añadir valores que no sean undefined
        if (value !== undefined) {
          formData.append(key, value);
        }
      });

      // Añadir las imágenes
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
    
    // Convertir los tiempos a segundos
    const getSeconds = (timeStr) => {
      const match = timeStr.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
      if (!match) return null;
      const [, minutes, seconds, milliseconds] = match.map(Number);
      return minutes * 60 + seconds + milliseconds / 1000;
    };

    const totalSeconds = getSeconds(totalTime);
    const bestLapSeconds = getSeconds(bestLapTime);
    
    if (totalSeconds === null || bestLapSeconds === null) return '';

    // Validar que el tiempo total sea coherente
    const minimumTotalSeconds = bestLapSeconds * laps;
    if (totalSeconds < minimumTotalSeconds) {
      const minimumTime = `${String(Math.floor(minimumTotalSeconds / 60)).padStart(2, '0')}:${String(Math.floor(minimumTotalSeconds % 60)).padStart(2, '0')}.${String(Math.floor((minimumTotalSeconds % 1) * 1000)).padStart(3, '0')}`;
      setTimingWarning(`⚠️ El tiempo total (${totalTime}) es menor que el mínimo posible (${minimumTime}) para ${laps} vueltas con mejor vuelta de ${bestLapTime}`);
    } else {
      setTimingWarning(null);
    }
    
    // Calcular el promedio
    const averageSeconds = totalSeconds / laps;
    
    // Convertir de vuelta a formato mm:ss.ms
    const avgMinutes = Math.floor(averageSeconds / 60);
    const avgSeconds = Math.floor(averageSeconds % 60);
    const avgMilliseconds = Math.floor((averageSeconds % 1) * 1000);
    
    return `${String(avgMinutes).padStart(2, '0')}:${String(avgSeconds).padStart(2, '0')}.${String(avgMilliseconds).padStart(3, '0')}`;
  };

  const handleTimingChange = (e) => {
    const { name, value } = e.target;
    const targetTiming = editingTiming || newTiming;
    const updateFn = editingTiming ? setEditingTiming : setNewTiming;

    // Convertir tiempos a timestamp si es necesario
    let timestamp = null;
    if (['best_lap_time', 'total_time', 'average_time'].includes(name)) {
      // Formato esperado: mm:ss.ms (ejemplo: 01:23.456)
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

    // Si se actualiza el tiempo total o las vueltas, recalcular el promedio
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
    // Calcular el promedio al cargar el tiempo para editar
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
      average_time: averageTime || timing.average_time, // Usar el promedio recalculado o el existente
      lane: timing.lane || '',
      circuit: timing.circuit || '',
      timing_date: timing.timing_date,
      best_lap_timestamp: timing.best_lap_timestamp,
      total_time_timestamp: timing.total_time_timestamp,
      average_time_timestamp: average_time_timestamp || timing.average_time_timestamp // Usar el timestamp recalculado o el existente
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
      timing_date: new Date().toISOString().split('T')[0],
      best_lap_timestamp: null,
      total_time_timestamp: null,
      average_time_timestamp: null
    });
  };

  const handleAddTiming = async (e) => {
    e.preventDefault();
    try {
      if (editingTiming) {
        await api.put(`/vehicles/${id}/timings/${editingTiming.id}`, editingTiming);
      } else {
        await api.post(`/vehicles/${id}/timings`, newTiming);
      }

      // Recargar tiempos
      const response = await api.get(`/vehicles/${id}/timings`);
      setTimings(response.data);
      
      // Limpiar el formulario
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
      await api.delete(`/vehicles/${id}/timings/${timingId}`);
      // Recargar tiempos
      const response = await api.get(`/vehicles/${id}/timings`);
      setTimings(response.data);
    } catch (error) {
      console.error('Error al eliminar tiempo:', error);
      setError('Error al eliminar el registro de tiempo');
    }
  };

  // Función para agrupar tiempos por circuito y carril
  const getTimingsByCircuitAndLane = () => {
    const grouped = {};
    
    timings.forEach(timing => {
      if (timing.circuit && timing.lane) {
        const key = `${timing.circuit}-${timing.lane}`;
        if (!grouped[key]) {
          grouped[key] = {
            circuit: timing.circuit,
            lane: timing.lane,
            timings: []
          };
        }
        grouped[key].timings.push(timing);
      }
    });

    // Solo incluir grupos con más de un tiempo para mostrar evolución
    return Object.values(grouped).filter(group => group.timings.length >= 2);
  };

  const renderSpecsForm = (isModificationTab = false) => {
    const currentSpec = isModificationTab ? technicalSpecs.modification : technicalSpecs.technical;
    const components = currentSpec?.components || [];

    return (
      <div className="mt-4">
        <h4>{editingSpec ? 'Editar' : 'Añadir'} {isModificationTab ? 'Modificación' : 'Especificación Técnica'}</h4>
        <Form onSubmit={e => handleAddSpec(e, isModificationTab)}>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Tipo de Componente</Form.Label>
                <Form.Select
                  name="component_type"
                  value={editingSpec?.component_type || newSpec.component_type}
                  onChange={handleSpecChange}
                  required
                >
                  <option value="">Seleccionar tipo</option>
                  {componentTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Elemento</Form.Label>
                <Form.Control
                  name="element"
                  value={editingSpec?.element || newSpec.element}
                  onChange={handleSpecChange}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Marca</Form.Label>
                <Form.Control
                  name="manufacturer"
                  value={editingSpec?.manufacturer || newSpec.manufacturer}
                  onChange={handleSpecChange}
                  required
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Material</Form.Label>
                <Form.Control
                  name="material"
                  value={editingSpec?.material || newSpec.material}
                  onChange={handleSpecChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Tamaño</Form.Label>
                <Form.Control
                  name="size"
                  value={editingSpec?.size || newSpec.size}
                  onChange={handleSpecChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Color</Form.Label>
                <Form.Control
                  name="color"
                  value={editingSpec?.color || newSpec.color}
                  onChange={handleSpecChange}
                />
              </Form.Group>
            </Col>
          </Row>
          {['pinion', 'crown'].includes(editingSpec?.component_type || newSpec.component_type) && (
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Dientes</Form.Label>
                  <Form.Control
                    name="teeth"
                    type="number"
                    value={editingSpec?.teeth || newSpec.teeth}
                    onChange={handleSpecChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
          {(editingSpec?.component_type || newSpec.component_type) === 'motor' && (
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>RPM</Form.Label>
                  <Form.Control
                    name="rpm"
                    type="number"
                    value={editingSpec?.rpm || newSpec.rpm}
                    onChange={handleSpecChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Gaus</Form.Label>
                  <Form.Control
                    name="gaus"
                    type="number"
                    value={editingSpec?.gaus || newSpec.gaus}
                    onChange={handleSpecChange}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Precio (€)</Form.Label>
                <Form.Control
                  name="price"
                  type="number"
                  step="0.01"
                  value={editingSpec?.price || newSpec.price}
                  onChange={handleSpecChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>URL</Form.Label>
                <Form.Control
                  name="url"
                  type="url"
                  value={editingSpec?.url || newSpec.url}
                  onChange={handleSpecChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>SKU</Form.Label>
                <Form.Control
                  name="sku"
                  value={editingSpec?.sku || newSpec.sku}
                  onChange={handleSpecChange}
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={12}>
              <Form.Group className="mb-3">
                <Form.Label>Descripción</Form.Label>
                <Form.Control
                  name="description"
                  as="textarea"
                  rows={3}
                  value={editingSpec?.description || newSpec.description}
                  onChange={handleSpecChange}
                />
              </Form.Group>
            </Col>
          </Row>
          {!isModificationTab && (
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    name="is_modification"
                    label="Es una modificación"
                    checked={editingSpec?.is_modification || newSpec.is_modification}
                    onChange={handleSpecChange}
                  />
                </Form.Group>
              </Col>
            </Row>
          )}
          <div className="d-flex gap-2 mt-3">
            <Button type="submit" variant="primary">
              {editingSpec ? 'Actualizar' : 'Añadir'} {isModificationTab ? 'Modificación' : 'Especificación'}
            </Button>
            {editingSpec && (
              <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </Form>
        <div className="mt-4">
          <h4>{isModificationTab ? 'Modificaciones Actuales' : 'Especificaciones Técnicas Actuales'}</h4>
          {loadingSpecs ? (
            <Spinner animation="border" />
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Elemento</th>
                    <th>Marca</th>
                    <th>Material</th>
                    <th>Tamaño</th>
                    <th>Color</th>
                    <th>Precio</th>
                    <th>URL</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {components.length === 0 && (
                    <tr><td colSpan="9" className="text-center">No hay {isModificationTab ? 'modificaciones' : 'especificaciones técnicas'}</td></tr>
                  )}
                  {components.map((comp, idx) => (
                    <tr key={currentSpec.id + '-' + idx}>
                      <td>{componentTypes.find(t => t.value === comp.component_type)?.label || comp.component_type}</td>
                      <td>{comp.element}</td>
                      <td>{comp.manufacturer}</td>
                      <td>{comp.material}</td>
                      <td>{comp.size}</td>
                      <td>{comp.color}</td>
                      <td>{comp.price ? `€${Number(comp.price).toFixed(2)}` : '-'}</td>
                      <td>
                        {comp.url ? (
                          <a href={comp.url} target="_blank" rel="noopener noreferrer" title="Abrir enlace">
                            <FiExternalLink size={18} />
                          </a>
                        ) : (
                          '-' 
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleEditSpec(currentSpec, comp)}
                            title="Editar"
                          >
                            ✏️
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteSpec(currentSpec.id, comp.id)}
                            title="Eliminar"
                          >
                            🗑️
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* Fila de suma total solo en la pestaña de modificaciones */}
                  {isModificationTab && components.length > 0 && (
                    <tr>
                      <td colSpan="7" className="text-end fw-bold">Total modificaciones</td>
                      <td className="fw-bold">
                        €{components.reduce((sum, comp) => sum + (comp.price ? Number(comp.price) : 0), 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTimingsForm = () => {
    return (
      <div className="mt-4">
        <h4>{editingTiming ? 'Editar' : 'Añadir'} Registro de Tiempo</h4>
        {timingWarning && (
          <Alert variant="warning" className="mb-3">
            {timingWarning}
          </Alert>
        )}
        <Form onSubmit={handleAddTiming}>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Mejor Vuelta (mm:ss.ms)</Form.Label>
                <Form.Control
                  name="best_lap_time"
                  value={editingTiming?.best_lap_time || newTiming.best_lap_time}
                  onChange={handleTimingChange}
                  placeholder="00:00.000"
                  pattern="\d{2}:\d{2}\.\d{3}"
                  title="Formato: mm:ss.ms (ejemplo: 01:23.456)"
                  required
                />
                <Form.Text className="text-muted">
                  Formato: mm:ss.ms (ejemplo: 01:23.456)
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Tiempo Total (mm:ss.ms)</Form.Label>
                <Form.Control
                  name="total_time"
                  value={editingTiming?.total_time || newTiming.total_time}
                  onChange={handleTimingChange}
                  placeholder="00:00.000"
                  pattern="\d{2}:\d{2}\.\d{3}"
                  title="Formato: mm:ss.ms (ejemplo: 01:23.456)"
                  required
                />
                <Form.Text className="text-muted">
                  Formato: mm:ss.ms (ejemplo: 01:23.456)
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Vueltas</Form.Label>
                <Form.Control
                  name="laps"
                  type="number"
                  value={editingTiming?.laps || newTiming.laps}
                  onChange={handleTimingChange}
                  required
                  min="1"
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Tiempo Promedio (mm:ss.ms)</Form.Label>
                <Form.Control
                  name="average_time"
                  value={editingTiming?.average_time || newTiming.average_time}
                  readOnly
                  className="bg-light"
                />
                <Form.Text className="text-muted">
                  Calculado automáticamente
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Carril</Form.Label>
                <Form.Control
                  name="lane"
                  value={editingTiming?.lane || newTiming.lane}
                  onChange={handleTimingChange}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Fecha</Form.Label>
                <Form.Control
                  name="timing_date"
                  type="date"
                  value={editingTiming?.timing_date || newTiming.timing_date}
                  onChange={handleTimingChange}
                  required
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Circuito</Form.Label>
                <Form.Control
                  name="circuit"
                  value={editingTiming?.circuit || newTiming.circuit}
                  onChange={handleTimingChange}
                  placeholder="Nombre del circuito"
                />
              </Form.Group>
            </Col>
          </Row>
          <div className="d-flex gap-2 mt-3">
            <Button type="submit" variant="primary">
              {editingTiming ? 'Actualizar' : 'Añadir'} Registro
            </Button>
            {editingTiming && (
              <Button type="button" variant="secondary" onClick={handleCancelEditTiming}>
                Cancelar
              </Button>
            )}
          </div>
        </Form>
        <div className="mt-4">
          <h4>Registros de Tiempo</h4>
          {loadingTimings ? (
            <Spinner animation="border" />
          ) : (
            <>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Mejor Vuelta</th>
                      <th>Tiempo Total</th>
                      <th>Vueltas</th>
                      <th>Tiempo Promedio</th>
                      <th>Carril</th>
                      <th>Circuito</th>
                      <th className="text-center">Configuración</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timings.length === 0 && (
                      <tr><td colSpan="8" className="text-center">No hay registros de tiempo</td></tr>
                    )}
                    {timings.map((timing) => (
                      <tr key={timing.id}>
                        <td>{new Date(timing.timing_date).toLocaleDateString()}</td>
                        <td className="font-monospace">{timing.best_lap_time}</td>
                        <td className="font-monospace">{timing.total_time}</td>
                        <td>{timing.laps}</td>
                        <td className="font-monospace">{timing.average_time}</td>
                        <td>{timing.lane || '-'}</td>
                        <td>{timing.circuit || '-'}</td>
                        <td className="text-center">
                          {timing.setup_snapshot ? (
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => {
                                setSelectedTiming(timing);
                                setShowSpecsModal(true);
                              }}
                              title="Ver especificaciones técnicas"
                            >
                              🔧 Ver Config
                            </Button>
                          ) : (
                            <span className="text-muted small">Sin config</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleEditTiming(timing)}
                              title="Editar"
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteTiming(timing.id)}
                              title="Eliminar"
                            >
                              🗑️
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Gráficas de evolución de tiempos */}
              {timings.length > 0 && (
                <div className="mt-5">
                  <h4>Evolución de Tiempos por Circuito y Carril</h4>
                  <p className="text-muted mb-4">
                    Se muestran gráficas de evolución para circuitos y carriles con múltiples registros de tiempo.
                  </p>
                  
                  {(() => {
                    const groupedTimings = getTimingsByCircuitAndLane();
                    if (groupedTimings.length === 0) {
                      return (
                        <div className="text-center text-muted py-4">
                          <p>No hay suficientes registros de tiempo para mostrar evolución.</p>
                          <p className="small">Se necesitan al menos 2 registros del mismo circuito y carril.</p>
                        </div>
                      );
                    }
                    
                    return groupedTimings.map((group, index) => (
                      <TimingEvolutionChart
                        key={`${group.circuit}-${group.lane}`}
                        timings={group.timings}
                        circuit={group.circuit}
                        lane={group.lane}
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

  if (loading || !vehicle) return <Spinner animation="border" />;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Editar Vehículo{vehicle.model ? `: ${vehicle.model}` : ''}</h2>
        <Button variant="secondary" onClick={() => navigate('/vehicles')}>
          Volver al listado
        </Button>
      </div>
      <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="general">Información General</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="technical">Especificaciones Técnicas</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="modifications">Modificaciones</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="timings">Tabla de Tiempos</Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="general">
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Modelo</Form.Label>
                    <Form.Control name="model" value={vehicle.model || ''} onChange={handleChange} required />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Referencia</Form.Label>
                    <Form.Control name="reference" value={vehicle.reference || ''} onChange={handleChange} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Fabricante</Form.Label>
                    <Form.Control name="manufacturer" value={vehicle.manufacturer || ''} onChange={handleChange} required />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Tipo</Form.Label>
                    <Form.Select name="type" value={vehicle.type || ''} onChange={handleChange} required>
                      <option value="">Selecciona tipo</option>
                      <option>Rally</option>
                      <option>GT</option>
                      <option>LMP</option>
                      <option>Clásico</option>
                      <option>DTM</option>
                      <option>F1</option>
                      <option>Camiones</option>
                      <option>Raid</option>
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Tracción</Form.Label>
                    <Form.Control name="traction" value={vehicle.traction || ''} onChange={handleChange} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Precio original (€)</Form.Label>
                    <Form.Control name="price" type="number" step="0.01" value={vehicle.price || ''} onChange={handleChange} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Fecha de compra</Form.Label>
                    <Form.Control name="purchase_date" type="date" value={vehicle.purchase_date ? vehicle.purchase_date.substring(0, 10) : ''} onChange={handleChange} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Lugar de compra</Form.Label>
                    <Form.Control name="purchase_place" value={vehicle.purchase_place || ''} onChange={handleChange} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Check name="modified" label="Modificado" checked={!!vehicle.modified} onChange={handleChange} />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Check name="digital" label="Digital" checked={!!vehicle.digital} onChange={handleChange} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <h5>Fotografías</h5>
                  <Row>
                    {imageFields.map(({ name, label }) => (
                      <Col xs={6} md={6} className="mb-3" key={name}>
                        <Form.Label>{label} Imagen</Form.Label>
                        <div className="border rounded d-flex flex-column align-items-center justify-content-center p-2 position-relative" 
                             style={{ minHeight: 120, borderStyle: 'dashed', cursor: 'pointer', background: '#fff8f8' }} 
                             onClick={(e) => {
                               if (!previews[name] && !images[name]) {
                                 document.getElementById(`img-${name}`).click();
                               }
                             }}>
                          {previews[name] || images[name] ? (
                            <>
                              <img 
                                ref={el => imageRefs.current[name] = el}
                                src={previews[name] || URL.createObjectURL(images[name])} 
                                alt={label} 
                                style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }} 
                                loading="lazy"
                              />
                              <Button
                                variant="danger"
                                size="sm"
                                className="position-absolute top-0 end-0 m-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteImage(name);
                                }}
                                disabled={deletingImage === name}
                              >
                                {deletingImage === name ? (
                                  <Spinner animation="border" size="sm" />
                                ) : (
                                  '×'
                                )}
                              </Button>
                            </>
                          ) : (
                            <span className="text-secondary">Imagen</span>
                          )}
                          <input
                            id={`img-${name}`}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => handleImageChange(e, name)}
                          />
                        </div>
                      </Col>
                    ))}
                  </Row>
                </Col>
              </Row>
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="d-flex justify-content-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => navigate('/vehicles')}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Actualizar'}</Button>
              </div>
            </Form>
          </Tab.Pane>
          
          <Tab.Pane eventKey="technical">
            {renderSpecsForm(false)}
          </Tab.Pane>
          
          <Tab.Pane eventKey="modifications">
            {renderSpecsForm(true)}
          </Tab.Pane>
          
          <Tab.Pane eventKey="timings">
            {renderTimingsForm()}
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>

      {/* Modal de especificaciones técnicas */}
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