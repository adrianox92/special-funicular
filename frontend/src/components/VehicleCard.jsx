import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { Download, Trash2, Calendar, MapPin, Gauge } from 'lucide-react';
import api from '../lib/axios';
import { formatDistance } from '../utils/formatUtils';
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
} from './ui/alert-dialog';
import placeholderImage from '../assets/images/placeholder.png';

const VehicleCard = ({ vehicle, onDelete }) => {
  const navigate = useNavigate();
  const imgRef = useRef(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (imgRef.current) {
      const ro = new ResizeObserver(() => {});
      ro.observe(imgRef.current);
      return () => ro.disconnect();
    }
  }, []);

  const handleDelete = (e) => {
    e.stopPropagation();
    setDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/vehicles/${vehicle.id}`);
      setDeleteConfirm(false);
      if (onDelete) onDelete(vehicle.id);
    } catch (error) {
      console.error('Error al eliminar vehículo:', error);
      toast.error('Error al eliminar el vehículo');
    }
  };

  const handleDownloadSpecs = async (e) => {
    e.stopPropagation();
    try {
      const response = await api.get(`/vehicles/${vehicle.id}/specs-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `ficha-tecnica-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error al descargar la ficha técnica:', error);
      toast.error('Error al descargar la ficha técnica');
    }
  };

  return (
    <>
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vehículo?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar este vehículo? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/vehicles/${vehicle.id}`)}>
      {vehicle.modified && (
        <Badge className="absolute top-2 left-2 z-10">Modificado</Badge>
      )}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button size="sm" onClick={handleDownloadSpecs} title="Descargar ficha técnica">
          <Download className="size-4" />
        </Button>
        <Button size="sm" variant="destructive" onClick={handleDelete} title="Eliminar vehículo">
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="relative aspect-[4/3] bg-muted">
        <img ref={imgRef} src={vehicle.image || placeholderImage} alt={vehicle.model} className="w-full h-full object-cover" loading="lazy" />
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg">{vehicle.model}</h3>
        <p className="text-sm text-muted-foreground">
          {vehicle.manufacturer}
          {vehicle.reference && <span> - {vehicle.reference}</span>}
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant="secondary">{vehicle.type}</Badge>
          <Badge variant="secondary">{vehicle.traction}</Badge>
          {vehicle.museo && <Badge variant="secondary">Museo</Badge>}
          {vehicle.taller && <Badge variant="secondary">Taller</Badge>}
        </div>
        <div className="mt-3 text-sm">
          {vehicle.total_price !== undefined && vehicle.total_price !== null && vehicle.total_price !== vehicle.price ? (
            <>
              {vehicle.price && (
                <>
                  <span className="line-through text-muted-foreground">€{Number(vehicle.price).toFixed(2)}</span>
                  <span className="ml-2 font-medium">€{Number(vehicle.total_price).toFixed(2)}</span>
                  {vehicle.price > 0 && (
                    <span className="text-green-600 dark:text-green-400 ml-1">(+{((vehicle.total_price - vehicle.price) / vehicle.price * 100).toFixed(1)}%)</span>
                  )}
                </>
              )}
            </>
          ) : (
            vehicle.price && <span className="font-medium">€{Number(vehicle.price).toFixed(2)}</span>
          )}
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="size-3" />
            {new Date(vehicle.purchase_date).toLocaleDateString()}
          </div>
          {vehicle.purchase_place && (
            <div className="flex items-center gap-1">
              <MapPin className="size-3" />
              {vehicle.purchase_place}
            </div>
          )}
          {vehicle.total_distance_meters != null && vehicle.total_distance_meters > 0 && (
            <div className="flex items-center gap-1">
              <Gauge className="size-3" />
              Odómetro: {formatDistance(vehicle.total_distance_meters)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </>
  );
};

export default VehicleCard;
