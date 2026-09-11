import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../../lib/axios';
import { IMAGE_FIELD_NAMES, viewTypeMap } from './constants';

export function useVehicleCore(id) {
  const { t } = useTranslation('vehicles');
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [images, setImages] = useState({});
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingImage, setDeletingImage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [draggingOver, setDraggingOver] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const imageRefs = useRef({});
  const [circuits, setCircuits] = useState([]);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);

  const getApiBaseUrl = useCallback(() => {
    if (process.env.REACT_APP_API_URL) {
      return String(process.env.REACT_APP_API_URL).replace(/\/$/, '');
    }
    if (process.env.NODE_ENV === 'production') {
      return 'https://api.slotdatabase.es/api';
    }
    return 'http://localhost:5001/api';
  }, []);

  const openQrDialog = useCallback(async () => {
    setShowQrDialog(true);
    setQrError(null);
    setQrDataUrl(null);
    setQrLoading(true);
    try {
      const base = getApiBaseUrl();
      const url = `${base}/public/vehicles/${id}/specs-pdf`;
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        width: 512,
        margin: 2,
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrError(t('edit.errors.qrGenerate'));
    } finally {
      setQrLoading(false);
    }
  }, [getApiBaseUrl, id, t]);

  const closeQrDialog = useCallback(() => {
    setShowQrDialog(false);
  }, []);

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
        setError(t('edit.errors.loadVehicle'));
        setLoading(false);
      });
  }, [id, t]);

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

  const imageFields = useMemo(
    () => IMAGE_FIELD_NAMES.map((name) => ({ name, label: t(`edit.images.${name}`) })),
    [t],
  );

  const gallerySlides = useMemo(
    () =>
      imageFields
        .filter(({ name }) => previews[name] || images[name])
        .map(({ name, label }) => ({
          name,
          label,
          url: previews[name] || URL.createObjectURL(images[name]),
        })),
    [previews, images, imageFields],
  );

  const gallerySlideIndexByName = useMemo(() => {
    const map = {};
    gallerySlides.forEach((slide, index) => {
      map[slide.name] = index;
    });
    return map;
  }, [gallerySlides]);

  const openGallery = (name) => {
    const index = gallerySlideIndexByName[name];
    if (index === undefined) return;
    setGalleryStartIndex(index);
    setGalleryOpen(true);
  };

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
      const { catalog_item: _catalogItemOmit, ...vehicleFlat } = vehicle;
      const processedVehicle = {
        ...vehicleFlat,
        price: vehicle.price === '' || vehicle.price === null ? undefined : Number(vehicle.price),
        total_price: vehicle.total_price === '' || vehicle.total_price === null ? undefined : Number(vehicle.total_price)
      };

      const sendEmptyIfNull = new Set(['dorsal', 'limited_edition_unit_number']);
      Object.entries(processedVehicle).forEach(([key, value]) => {
        // FormData convierte null en la cadena "null" → Postgres rechaza fechas y tipos
        if (value !== undefined && value !== null && typeof value !== 'object') {
          formData.append(key, value);
        } else if (sendEmptyIfNull.has(key) && (value === null || value === undefined)) {
          formData.append(key, '');
        }
      });

      imageFields.forEach(({ name }) => {
        if (images[name]) {
          formData.append('images', images[name], name);
        }
      });

      // No fijar Content-Type: axios debe añadir multipart/form-data con boundary automáticamente
      await api.put(`/vehicles/${id}`, formData);
      navigate('/vehicles');
    } catch (error) {
      console.error('Error al actualizar vehículo:', error);
      setError(error.response?.data?.error || t('edit.errors.updateVehicle'));
    } finally {
      setSaving(false);
    }
  };

  return {
    t,
    navigate,
    vehicle,
    setVehicle,
    images,
    previews,
    error,
    setError,
    saving,
    loading,
    deletingImage,
    deleteConfirm,
    setDeleteConfirm,
    draggingOver,
    galleryOpen,
    setGalleryOpen,
    galleryStartIndex,
    imageRefs,
    circuits,
    showQrDialog,
    setShowQrDialog,
    qrDataUrl,
    setQrDataUrl,
    qrLoading,
    qrError,
    setQrError,
    openQrDialog,
    closeQrDialog,
    imageFields,
    gallerySlides,
    openGallery,
    handleChange,
    handleImageChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleDeleteImage,
    confirmDeleteImage,
    handleSubmit,
  };
}
