import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { CopyPlus, Download, Trash2 } from 'lucide-react';
import api from '../lib/axios';
import { formatDistance, safeVehicleFileBasename } from '../utils/formatUtils';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import placeholderImage from '../assets/images/placeholder.png';
import DuplicateVehicleDialog from './DuplicateVehicleDialog';

const VehicleTableRow = ({ vehicle, onDelete, onDuplicate }) => {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  const handleDuplicate = (e) => {
    e.stopPropagation();
    if (onDuplicate) onDuplicate(vehicle);
  };

  const handleDownloadSpecs = async (e) => {
    e.stopPropagation();
    try {
      const response = await api.get(`/vehicles/${vehicle.id}/specs-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
        link.download = `${safeVehicleFileBasename(vehicle.model)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error al descargar la ficha técnica:', error);
      toast.error('Error al descargar la ficha técnica');
    }
  };

  const handleRowClick = () => navigate(`/vehicles/${vehicle.id}`);

  const formatPrice = () => {
    if (vehicle.total_price !== undefined && vehicle.total_price !== null && vehicle.total_price !== vehicle.price) {
      if (vehicle.price != null && vehicle.price !== '') {
        return (
          <>
            <span className="line-through text-muted-foreground">€{Number(vehicle.price).toFixed(2)}</span>
            <span className="ml-1 font-medium">€{Number(vehicle.total_price).toFixed(2)}</span>
          </>
        );
      }
      return <span className="font-medium">€{Number(vehicle.total_price).toFixed(2)}</span>;
    }
    if (vehicle.price != null && vehicle.price !== '') {
      return <span className="font-medium">€{Number(vehicle.price).toFixed(2)}</span>;
    }
    return <span className="text-muted-foreground italic">-</span>;
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

      <TableRow className="cursor-pointer transition-colors hover:bg-muted" onClick={handleRowClick}>
        <TableCell className="w-12 p-2">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block cursor-pointer rounded overflow-hidden">
                  <img
                    src={vehicle.image || placeholderImage}
                    alt={vehicle.model}
                    className="w-10 h-[30px] object-cover rounded"
                    loading="lazy"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="p-1 bg-background border shadow-lg">
                <img
                  src={vehicle.image || placeholderImage}
                  alt={vehicle.model}
                  className="w-48 h-32 object-contain rounded-md"
                />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="min-w-[140px]">
          <div className="font-medium">{vehicle.model}</div>
          <div className="text-xs text-muted-foreground">
            {vehicle.manufacturer}
            {vehicle.reference != null && vehicle.reference !== '' && String(vehicle.reference) !== 'null' && ` - ${vehicle.reference}`}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {vehicle.type && <Badge variant="secondary" className="text-xs">{vehicle.type}</Badge>}
            {vehicle.traction && <Badge variant="secondary" className="text-xs">{vehicle.traction}</Badge>}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {vehicle.modified && <Badge variant="outline" className="text-xs">Mod.</Badge>}
            {vehicle.digital && <Badge variant="outline" className="text-xs">Dig.</Badge>}
            {vehicle.museo && <Badge variant="outline" className="text-xs">Museo</Badge>}
            {vehicle.taller && <Badge variant="outline" className="text-xs">Taller</Badge>}
          </div>
        </TableCell>
        <TableCell className="text-sm whitespace-nowrap">{formatPrice()}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {vehicle.purchase_date ? new Date(vehicle.purchase_date).toLocaleDateString() : '-'}
          {vehicle.purchase_place != null && vehicle.purchase_place !== '' && String(vehicle.purchase_place) !== 'null' && (
            <div className="truncate max-w-[100px]" title={vehicle.purchase_place}>{vehicle.purchase_place}</div>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {vehicle.total_distance_meters != null && vehicle.total_distance_meters > 0
            ? formatDistance(vehicle.total_distance_meters)
            : '-'}
        </TableCell>
        <TableCell className="min-w-[7.5rem] p-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="size-8" onClick={handleDuplicate} title="Duplicar vehículo">
              <CopyPlus className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={handleDownloadSpecs} title="Descargar ficha técnica">
              <Download className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={handleDelete} title="Eliminar vehículo">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
};

const VehicleTable = ({ vehicles, onDelete, onDuplicateSuccess }) => {
  const [duplicateVehicle, setDuplicateVehicle] = useState(null);

  return (
    <>
      <DuplicateVehicleDialog
        vehicle={duplicateVehicle}
        open={duplicateVehicle != null}
        onOpenChange={(open) => {
          if (!open) setDuplicateVehicle(null);
        }}
        onSuccess={() => onDuplicateSuccess?.()}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Compra</TableHead>
            <TableHead>Odómetro</TableHead>
            <TableHead className="min-w-[7.5rem] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((vehicle) => (
            <VehicleTableRow
              key={vehicle.id}
              vehicle={vehicle}
              onDelete={onDelete}
              onDuplicate={setDuplicateVehicle}
            />
          ))}
        </TableBody>
      </Table>
    </>
  );
};

export default VehicleTable;
