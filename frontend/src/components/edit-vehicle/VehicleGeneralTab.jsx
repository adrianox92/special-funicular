import React from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Alert } from '../ui/alert';
import { Spinner } from '../ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../ui/utils';
import { VEHICLE_TYPES as vehicleTypes } from '../../data/vehicleTypes';
import { MOTOR_POSITION_OPTIONS } from '../../data/motorPosition';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleGeneralTab() {
  const { t } = useTranslation('vehicles');
  const { t: tCommon } = useTranslation('common');
  const {
    vehicle,
    setVehicle,
    error,
    saving,
    navigate,
    handleSubmit,
    handleChange,
    imageFields,
    previews,
    images,
    draggingOver,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    imageRefs,
    openGallery,
    handleDeleteImage,
    deletingImage,
    handleImageChange,
  } = useEditVehicle();

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          <div className="space-y-6 min-w-0 order-2 lg:order-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('edit.cards.identification')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="model">{t('edit.fields.model')}</Label>
                  <Input id="model" name="model" value={vehicle.model || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">{t('edit.fields.reference')}</Label>
                  <Input id="reference" name="reference" value={vehicle.reference ?? ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">{t('edit.fields.manufacturer')}</Label>
                  <Input id="manufacturer" name="manufacturer" value={vehicle.manufacturer || ''} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{t('edit.fields.type')}</Label>
                  <Select
                    value={vehicle.type || 'none'}
                    onValueChange={(v) =>
                      handleChange({
                        target: { name: 'type', value: v === 'none' ? '' : v, type: 'select', checked: false },
                      })
                    }
                    required
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder={t('edit.selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('edit.selectType')}</SelectItem>
                      {vehicleTypes.map((typeName) => (
                        <SelectItem key={typeName} value={typeName}>
                          {typeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('edit.cards.technicalData')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="traction">{t('edit.fields.traction')}</Label>
                  <Input id="traction" name="traction" value={vehicle.traction || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motor_position">{t('edit.fields.motorPosition')}</Label>
                  <Select
                    value={vehicle.motor_position || '__none__'}
                    onValueChange={(v) =>
                      handleChange({
                        target: {
                          name: 'motor_position',
                          value: v === '__none__' ? '' : v,
                          type: 'select',
                          checked: false,
                        },
                      })
                    }
                  >
                    <SelectTrigger id="motor_position">
                      <SelectValue placeholder={t('edit.optional')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('edit.notSpecified')}</SelectItem>
                      {MOTOR_POSITION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('edit.cards.competition')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dorsal">{t('edit.fields.dorsal')}</Label>
                  <Input id="dorsal" name="dorsal" value={vehicle.dorsal ?? ''} onChange={handleChange} placeholder={t('edit.optional')} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="limited_edition"
                    checked={!!vehicle.limited_edition}
                    onCheckedChange={(checked) =>
                      setVehicle((prev) => ({
                        ...prev,
                        limited_edition: checked,
                        limited_edition_unit_number: checked ? prev.limited_edition_unit_number : null,
                      }))
                    }
                  />
                  <Label htmlFor="limited_edition" className="font-normal">
                    {t('edit.fields.limitedEdition')}
                  </Label>
                </div>
                {vehicle.limited_edition && (
                  <div className="space-y-2">
                    <Label htmlFor="limited_edition_unit_number">{t('edit.fields.unitNumber')}</Label>
                    <Input
                      id="limited_edition_unit_number"
                      name="limited_edition_unit_number"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={vehicle.limited_edition_unit_number ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setVehicle((prev) => ({
                          ...prev,
                          limited_edition_unit_number: v === '' ? null : parseInt(v, 10),
                        }));
                      }}
                      placeholder={t('edit.fields.unitNumberPlaceholder')}
                    />
                    {vehicle.catalog_item?.limited_edition_total != null && (
                      <p className="text-xs text-muted-foreground">
                        {t('edit.fields.catalogRun', { total: vehicle.catalog_item.limited_edition_total })}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('edit.cards.purchase')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('edit.fields.originalPrice')}</Label>
                  <Input id="price" name="price" type="number" step="0.01" value={vehicle.price || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">{t('edit.fields.purchaseDate')}</Label>
                  <Input
                    id="purchase_date"
                    name="purchase_date"
                    type="date"
                    value={vehicle.purchase_date ? vehicle.purchase_date.substring(0, 10) : ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchase_place">{t('edit.fields.purchasePlace')}</Label>
                  <Input id="purchase_place" name="purchase_place" value={vehicle.purchase_place ?? ''} onChange={handleChange} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('edit.cards.condition')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <div className="flex items-center gap-2 min-h-9">
                    <Switch
                      id="modified"
                      checked={!!vehicle.modified}
                      onCheckedChange={(checked) =>
                        handleChange({ target: { name: 'modified', type: 'checkbox', checked } })
                      }
                    />
                    <Label htmlFor="modified" className="font-normal">
                      {t('edit.fields.modified')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 min-h-9">
                    <Switch
                      id="digital"
                      checked={!!vehicle.digital}
                      onCheckedChange={(checked) =>
                        handleChange({ target: { name: 'digital', type: 'checkbox', checked } })
                      }
                    />
                    <Label htmlFor="digital" className="font-normal">
                      {t('edit.fields.digital')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 min-h-9">
                    <Switch
                      id="museo"
                      checked={!!vehicle.museo}
                      onCheckedChange={(checked) =>
                        handleChange({ target: { name: 'museo', type: 'checkbox', checked } })
                      }
                    />
                    <Label htmlFor="museo" className="font-normal">
                      {t('edit.fields.museum')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 min-h-9">
                    <Switch
                      id="taller"
                      checked={!!vehicle.taller}
                      onCheckedChange={(checked) =>
                        handleChange({ target: { name: 'taller', type: 'checkbox', checked } })
                      }
                    />
                    <Label htmlFor="taller" className="font-normal">
                      {t('edit.fields.workshop')}
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('edit.cards.scale')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="scale_factor">{t('edit.fields.scaleFactor')}</Label>
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
                <p className="text-xs text-muted-foreground">{t('edit.fields.scaleHint')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('edit.cards.notes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="anotaciones"
                  name="anotaciones"
                  rows={3}
                  value={vehicle.anotaciones ?? ''}
                  onChange={handleChange}
                  placeholder={t('edit.fields.notesPlaceholder')}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="order-1 lg:order-2 lg:sticky lg:top-4 self-start shadow-sm min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('edit.images.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {imageFields.map(({ name, label }) => (
                  <div key={name} className="space-y-2 min-w-0">
                    <Label className="text-xs sm:text-sm leading-snug">{label}</Label>
                    <div
                      className={cn(
                        'border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-2 sm:p-4 relative min-h-[100px] sm:min-h-[120px] transition-colors',
                        draggingOver === name
                          ? 'border-primary bg-primary/10'
                          : 'border-muted-foreground/25 bg-muted/30 hover:bg-muted/50',
                        !(previews[name] || images[name]) && 'cursor-pointer',
                      )}
                      onClick={
                        previews[name] || images[name]
                          ? undefined
                          : () => document.getElementById(`img-${name}`).click()
                      }
                      onDragEnter={(e) => handleDragEnter(e, name)}
                      onDragLeave={(e) => handleDragLeave(e, name)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, name)}
                    >
                      {previews[name] || images[name] ? (
                        <>
                          <img
                            ref={(el) => {
                              imageRefs.current[name] = el;
                            }}
                            src={previews[name] || URL.createObjectURL(images[name])}
                            alt={label}
                            className="max-w-full max-h-[72px] sm:max-h-[90px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            loading="lazy"
                            onClick={(e) => {
                              e.stopPropagation();
                              openGallery(name);
                            }}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 z-10 h-7 px-2 sm:h-9"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteImage(name);
                            }}
                            disabled={deletingImage === name}
                          >
                            {deletingImage === name ? <Spinner className="size-3.5 sm:size-4" /> : '×'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 h-8 gap-1 px-2 text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              document.getElementById(`img-${name}`).click();
                            }}
                          >
                            <Upload className="size-3.5" />
                            {t('edit.images.changePhoto')}
                          </Button>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs sm:text-sm text-center px-1">
                          {draggingOver === name ? t('edit.images.dropHere') : t('edit.images.dragOrClick')}
                        </span>
                      )}
                      <input
                        id={`img-${name}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageChange(e, name)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        {error && (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" type="button" onClick={() => navigate('/vehicles')}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" name="save-vehicle" disabled={saving}>
            {saving ? (
              <>
                <Spinner className="size-4 mr-2" />
                {t('edit.saving')}
              </>
            ) : (
              t('edit.update')
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
