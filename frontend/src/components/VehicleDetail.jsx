import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';
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
} from './ui/dialog';
import { Switch } from './ui/switch';

const imageFields = [
  { name: 'front', label: 'Delantera' },
  { name: 'left', label: 'Perfil Izquierdo' },
  { name: 'right', label: 'Perfil Derecho' },
  { name: 'rear', label: 'Trasera' },
  { name: 'top', label: 'Superior' },
  { name: 'chassis', label: 'Chasis' },
  { name: 'three_quarters', label: 'Vista 3/4' },
];

const VehicleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingImage, setDeletingImage] = useState(null);
  const [deleteImageConfirm, setDeleteImageConfirm] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`http://localhost:5001/api/vehicles/${id}`);
        setVehicle(res.data);
        const imgRes = await axios.get(`http://localhost:5001/api/vehicles/${id}/images`);
        const imgs = imgRes.data || [];
        const imagesObj = {};
        imgs.forEach(img => {
          imagesObj[img.view_type] = img.image_url;
        });
        setImages(imagesObj);
        setLoading(false);
      } catch {
        setError('Error al cargar el vehículo');
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleDeleteImage = (viewType) => {
    setDeleteImageConfirm(viewType);
  };

  const confirmDeleteImage = async () => {
    if (!deleteImageConfirm) return;
    const viewType = deleteImageConfirm;
    setDeleteImageConfirm(null);
    setDeletingImage(viewType);
    try {
      await axios.delete(`http://localhost:5001/api/vehicles/${id}/images/${viewType}`);
      setImages(prev => {
        const newImages = { ...prev };
        delete newImages[viewType];
        return newImages;
      });
      const imgRes = await axios.get(`http://localhost:5001/api/vehicles/${id}/images`);
      const imgs = imgRes.data || [];
      const imagesObj = {};
      imgs.forEach(img => { imagesObj[img.view_type] = img.image_url; });
      setImages(imagesObj);
    } catch (err) {
      setError('Error al eliminar la imagen');
    } finally {
      setDeletingImage(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner className="size-8" /></div>;
  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  if (!vehicle) return null;

  return (
    <>
      <AlertDialog open={!!deleteImageConfirm} onOpenChange={(open) => !open && setDeleteImageConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar imagen?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta imagen? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteImage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!lightboxImage} onOpenChange={(open) => !open && setLightboxImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-2 overflow-auto">
          {lightboxImage && (
            <img
              src={lightboxImage.url}
              alt={lightboxImage.label}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-6 mt-6">
      <h2 className="text-2xl font-bold">Detalle Vehículo</h2>
      <form className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[
              { name: 'model', label: 'Modelo', value: vehicle.model },
              { name: 'reference', label: 'Referencia', value: vehicle.reference },
              { name: 'manufacturer', label: 'Fabricante', value: vehicle.manufacturer },
              { name: 'traction', label: 'Tracción', value: vehicle.traction },
              { name: 'price', label: 'Precio original (€)', type: 'number', value: vehicle.price },
              { name: 'total_price', label: 'Precio actual (€)', type: 'number', value: vehicle.total_price },
              { name: 'purchase_date', label: 'Fecha de compra', type: 'date', value: vehicle.purchase_date?.substring(0, 10) },
              { name: 'purchase_place', label: 'Lugar de compra', value: vehicle.purchase_place },
            ].map(({ name, label, type, value }) => (
              <div key={name} className="space-y-2">
                <Label>{label}</Label>
                <Input name={name} type={type || 'text'} value={value || ''} disabled readOnly />
              </div>
            ))}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={vehicle.type || ''} disabled readOnly />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={!!vehicle.modified} disabled />
                <Label>Modificado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!vehicle.digital} disabled />
                <Label>Digital</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!vehicle.museo} disabled />
                <Label>Museo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!vehicle.taller} disabled />
                <Label>Taller</Label>
              </div>
            </div>
            {(vehicle.anotaciones != null && vehicle.anotaciones !== '') && (
              <div className="space-y-2">
                <Label>Anotaciones</Label>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md border border-input bg-muted/30 p-3">{vehicle.anotaciones}</p>
              </div>
            )}
          </div>
          <div>
            <h5 className="font-semibold mb-4">Fotografías</h5>
            <div className="grid grid-cols-2 gap-4">
              {imageFields.map(({ name, label }) => (
                <div key={name} className="space-y-2">
                  <Label>{label} Imagen</Label>
                  <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-4 relative min-h-[120px] bg-muted/30">
                    {images[name] ? (
                      <>
                        <img
                          src={images[name]}
                          alt={label}
                          className="max-w-full max-h-[90px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setLightboxImage({ url: images[name], label }); }}
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={() => handleDeleteImage(name)}
                          disabled={deletingImage === name}
                        >
                          {deletingImage === name ? <Spinner className="size-4" /> : '×'}
                        </Button>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Sin imagen</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate('/vehicles')}>Volver al listado</Button>
          <Button asChild><Link to={`/edit/${id}`}>Editar</Link></Button>
        </div>
      </form>
    </div>
    </>
  );
};

export default VehicleDetail;
