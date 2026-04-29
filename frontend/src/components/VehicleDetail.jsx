import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { getVehicleComponentTypeLabel } from '../data/componentTypes';
import { labelMotorPosition } from '../data/motorPosition';
import { formatModificationSnapshot, formatHistoryDate, modificationLineTotal } from '../utils/formatUtils';
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
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const imageFields = [
  { name: 'front', label: 'Delantera' },
  { name: 'left', label: 'Perfil Izquierdo' },
  { name: 'right', label: 'Perfil Derecho' },
  { name: 'rear', label: 'Trasera' },
  { name: 'top', label: 'Superior' },
  { name: 'chassis', label: 'Chasis' },
  { name: 'three_quarters', label: 'Vista 3/4' },
];

function ReadOnlyField({ name, label, type, value }) {
  return (
    <div className="space-y-2 min-w-0">
      <Label>{label}</Label>
      <Input name={name} type={type || 'text'} value={value ?? ''} disabled readOnly className="bg-muted/40" />
    </div>
  );
}

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
  const [modificationComponents, setModificationComponents] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vRes, imgRes, specRes] = await Promise.all([
          api.get(`/vehicles/${id}`),
          api.get(`/vehicles/${id}/images`),
          api.get(`/vehicles/${id}/technical-specs`)
        ]);
        setVehicle(vRes.data);
        const imgs = imgRes.data || [];
        const imagesObj = {};
        imgs.forEach(img => {
          imagesObj[img.view_type] = img.image_url;
        });
        setImages(imagesObj);
        const modSpec = (specRes.data || []).find(s => s.is_modification);
        setModificationComponents(modSpec?.components || []);
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
      await api.delete(`/vehicles/${id}/images/${viewType}`);
      setImages(prev => {
        const newImages = { ...prev };
        delete newImages[viewType];
        return newImages;
      });
      const imgRes = await api.get(`/vehicles/${id}/images`);
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

  const hasDorsal = vehicle.dorsal != null && String(vehicle.dorsal).trim() !== '';
  const showCompetitionSection = hasDorsal || !!vehicle.limited_edition;

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
            <AlertDialogAction type="button" onClick={confirmDeleteImage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
      <h2 className="text-2xl font-bold tracking-tight">Detalle del vehículo</h2>
      <p className="text-sm text-muted-foreground -mt-4">Información general</p>
      <form className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          <div className="space-y-6 min-w-0 order-2 lg:order-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Identificación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReadOnlyField name="model" label="Modelo" value={vehicle.model} />
                <ReadOnlyField name="reference" label="Referencia" value={vehicle.reference} />
                <ReadOnlyField name="manufacturer" label="Fabricante" value={vehicle.manufacturer} />
                <ReadOnlyField name="type" label="Tipo" value={vehicle.type} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Datos técnicos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReadOnlyField name="traction" label="Tracción" value={vehicle.traction} />
                <ReadOnlyField
                  name="motor_position"
                  label="Posición del motor"
                  value={labelMotorPosition(vehicle.motor_position)}
                />
              </CardContent>
            </Card>

            {showCompetitionSection && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Competición y edición limitada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasDorsal && <ReadOnlyField name="dorsal" label="Dorsal" value={vehicle.dorsal} />}
                  {vehicle.limited_edition && (
                    <div className="space-y-2">
                      <Label>Edición limitada</Label>
                      <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
                        <p className="font-medium text-foreground">Ejemplar en edición limitada</p>
                        {vehicle.limited_edition_unit_number != null &&
                          vehicle.limited_edition_unit_number !== '' && (
                            <p className="text-muted-foreground">
                              Unidad n.º <span className="text-foreground tabular-nums">{vehicle.limited_edition_unit_number}</span>
                            </p>
                          )}
                        {vehicle.catalog_item?.limited_edition_total != null && (
                          <p className="text-muted-foreground">
                            Tirada en catálogo:{' '}
                            <span className="text-foreground tabular-nums">
                              {vehicle.catalog_item.limited_edition_total}
                            </span>{' '}
                            unidades
                          </p>
                        )}
                        {!(
                          (vehicle.limited_edition_unit_number != null &&
                            vehicle.limited_edition_unit_number !== '') ||
                          vehicle.catalog_item?.limited_edition_total != null
                        ) && <p className="text-muted-foreground">Sin número de unidad ni tirada en catálogo.</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Compra y precios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReadOnlyField name="price" label="Precio original (€)" type="number" value={vehicle.price} />
                <ReadOnlyField name="total_price" label="Precio actual (€)" type="number" value={vehicle.total_price} />
                <ReadOnlyField
                  name="purchase_date"
                  label="Fecha de compra"
                  type="date"
                  value={vehicle.purchase_date?.substring(0, 10)}
                />
                <ReadOnlyField name="purchase_place" label="Lugar de compra" value={vehicle.purchase_place} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Estado del ejemplar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    ['modified', vehicle.modified, 'Modificado'],
                    ['digital', vehicle.digital, 'Digital'],
                    ['museo', vehicle.museo, 'Museo'],
                    ['taller', vehicle.taller, 'Taller'],
                  ].map(([key, checked, text]) => (
                    <div key={key} className="flex items-center gap-2 min-h-9 rounded-md border border-transparent px-0 sm:px-1 py-0.5">
                      <Switch id={`vf-${key}`} checked={!!checked} disabled />
                      <Label htmlFor={`vf-${key}`} className="font-normal cursor-default">
                        {text}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="order-1 lg:order-2 lg:sticky lg:top-4 self-start shadow-sm min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fotografías</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {imageFields.map(({ name, label }) => (
                  <div key={name} className="space-y-2 min-w-0">
                    <Label className="text-xs sm:text-sm leading-snug">{label}</Label>
                    <div className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-2 sm:p-4 relative min-h-[100px] sm:min-h-[120px] bg-muted/30">
                      {images[name] ? (
                        <>
                          <img
                            src={images[name]}
                            alt={label}
                            className="max-w-full max-h-[72px] sm:max-h-[90px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage({ url: images[name], label });
                            }}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-7 w-7 sm:h-8 sm:w-8 shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteImage(name);
                            }}
                            disabled={deletingImage === name}
                          >
                            {deletingImage === name ? <Spinner className="size-3.5 sm:size-4" /> : '×'}
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs sm:text-sm text-center px-1">Sin imagen</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {vehicle.anotaciones != null &&
          vehicle.anotaciones !== '' &&
          String(vehicle.anotaciones) !== 'null' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Anotaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md border bg-muted/30 p-3 sm:p-4">
                  {vehicle.anotaciones}
                </p>
              </CardContent>
            </Card>
          )}
        {modificationComponents.length > 0 && (
          <div className="space-y-4 border-t border-border pt-6">
            <h3 className="text-lg font-semibold tracking-tight">Modificaciones</h3>
            <ul className="space-y-4">
              {modificationComponents.map((comp) => {
                const qtyRaw = parseInt(comp.mounted_qty, 10);
                const qty = Number.isNaN(qtyRaw) || qtyRaw < 1 ? 1 : qtyRaw;
                const hasPrice = comp.price != null && comp.price !== '' && !Number.isNaN(Number(comp.price));
                const lineTotal = hasPrice ? modificationLineTotal(comp.price, comp.mounted_qty) : null;
                return (
                <li key={comp.id} className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <p className="font-medium">
                    {getVehicleComponentTypeLabel(comp.component_type)}
                    {comp.element ? ` · ${comp.element}` : ''}
                    {comp.manufacturer ? ` · ${comp.manufacturer}` : ''}
                    {hasPrice && (
                      <>
                        {' · '}
                        {qty > 1
                          ? `P. unit.: ${Number(comp.price).toFixed(2)} € × ${qty} = ${lineTotal.toFixed(2)} €`
                          : `${Number(comp.price).toFixed(2)} €`}
                      </>
                    )}
                  </p>
                  {comp.change_history?.length > 0 && (
                    <div className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
                      <p className="text-xs font-medium uppercase tracking-wide mb-1">Historial</p>
                      <ul className="list-disc list-inside space-y-1">
                        {comp.change_history.map((h) => (
                          <li key={h.id}>
                            Desde el {formatHistoryDate(h.effective_date)}: {formatModificationSnapshot(h.previous_snapshot)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
              })}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/vehicles')}>
            Volver al listado
          </Button>
          <Button asChild>
            <Link to={`/vehicles/${id}`}>Editar</Link>
          </Button>
        </div>
      </form>
    </div>
    </>
  );
};

export default VehicleDetail;
