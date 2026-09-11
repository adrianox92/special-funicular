import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExternalLink,
  Pencil,
  Trash2,
  Info,
  Package,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { Spinner } from '../ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  vehicleComponentTypes as componentTypes,
  getVehicleComponentTypeLabel,
} from '../../data/componentTypes';
import {
  formatModificationSnapshot,
  formatHistoryDate,
  formatInventoryCategory,
  modificationLineTotal,
} from '../../utils/formatUtils';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleSpecsTab({ isModificationTab = false }) {
  const { t } = useTranslation('vehicles');
  const { t: tCommon } = useTranslation('common');
  const {
    technicalSpecs,
    editingSpec,
    newSpec,
    loadingSpecs,
    selectedInventoryItemId,
    selectedInventoryItemName,
    selectedInventoryMountQty,
    setSelectedInventoryMountQty,
    selectedInventoryMaxQty,
    setInventoryPickerOpen,
    loadInventoryForPicker,
    clearInventoryLink,
    matchedPart,
    deductFromInventory,
    setDeductFromInventory,
    handleSpecChange,
    handleAddSpec,
    handleCancelEdit,
    handleEditSpec,
    handleDeleteSpec,
  } = useEditVehicle();

  const currentSpec = isModificationTab ? technicalSpecs.modification : technicalSpecs.technical;
  const components = currentSpec?.components || [];
  const specValue = editingSpec || newSpec;
  const fromInventory = !editingSpec && selectedInventoryItemId;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-lg font-semibold">
          {editingSpec
            ? isModificationTab
              ? t('edit.specs.editModification')
              : t('edit.specs.editSpec')
            : isModificationTab
              ? t('edit.specs.addModification')
              : t('edit.specs.addSpec')}
        </h4>
        {!editingSpec && (
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
            {t('edit.specs.fromInventory')}
          </Button>
        )}
      </div>
      {fromInventory && (
        <Alert>
          <Info className="size-4 shrink-0" aria-hidden />
          <AlertDescription className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <span>
                {t('edit.specs.usingInventory', {
                  name: selectedInventoryItemName,
                  count: (() => {
                    const n = Math.min(
                      Math.max(1, parseInt(selectedInventoryMountQty, 10) || 1),
                      selectedInventoryMaxQty ?? 1,
                    );
                    return n;
                  })(),
                  unit: (() => {
                    const n = Math.min(
                      Math.max(1, parseInt(selectedInventoryMountQty, 10) || 1),
                      selectedInventoryMaxQty ?? 1,
                    );
                    return n === 1 ? t('modals.unit') : t('modals.units');
                  })(),
                  max: selectedInventoryMaxQty ?? '—',
                })}
              </span>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 self-start" onClick={clearInventoryLink}>
                {t('edit.specs.removeLink')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('edit.specs.unitsHint')}</p>
          </AlertDescription>
        </Alert>
      )}
      {!editingSpec && !fromInventory && matchedPart && Number(matchedPart.stock_qty) > 0 && (
        <Alert>
          <Package className="size-4 shrink-0" aria-hidden />
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {t('edit.specs.stockMatchAlert', {
                count: matchedPart.stock_qty,
                unit: matchedPart.stock_qty === 1 ? t('modals.unit') : t('modals.units'),
                name: matchedPart.part?.name || newSpec.element,
              })}
            </span>
            <div className="flex items-center gap-2">
              <Switch
                id={`deduct-inv-${isModificationTab ? 'mod' : 'tech'}`}
                checked={deductFromInventory == null ? isModificationTab : deductFromInventory}
                onCheckedChange={setDeductFromInventory}
              />
              <Label
                htmlFor={`deduct-inv-${isModificationTab ? 'mod' : 'tech'}`}
                className="cursor-pointer"
              >
                {t('edit.specs.deductFromInventory')}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('edit.specs.deductFromInventoryHint')}</p>
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={e => handleAddSpec(e, isModificationTab)}>
        {editingSpec && isModificationTab && (
          <>
            <Alert className="mb-4">
              <Info className="size-4 shrink-0" aria-hidden />
              <AlertDescription>{t('edit.specs.modHistoryHint')}</AlertDescription>
            </Alert>
            <div className="space-y-2 mb-4 max-w-xs">
              <Label htmlFor="change_effective_date">{t('edit.specs.changeDate')}</Label>
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
            <Label htmlFor="component_type">{t('edit.specs.componentType')}</Label>
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
                  <SelectValue placeholder={t('edit.specs.selectComponentType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('edit.specs.selectComponentType')}</SelectItem>
                  {componentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="element">{t('edit.specs.element')}</Label>
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
            <Label htmlFor="manufacturer">{t('edit.specs.brand')}</Label>
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
              {fromInventory ? t('edit.specs.unitsStockMount') : t('edit.specs.mountedUnits')}
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
                ? t('edit.specs.inventoryDeductHint', { max: selectedInventoryMaxQty ?? '—' })
                : t('edit.specs.mountedQtyHint')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="material">{t('edit.specs.material')}</Label>
            <Input id="material" name="material" value={specValue.material} onChange={handleSpecChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">{t('edit.specs.size')}</Label>
            <Input id="size" name="size" value={specValue.size} onChange={handleSpecChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">{t('edit.specs.color')}</Label>
            <Input id="color" name="color" value={specValue.color} onChange={handleSpecChange} />
          </div>
        </div>
        {['pinion', 'crown'].includes(specValue.component_type) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="teeth">{t('edit.specs.teeth')}</Label>
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
            <Label htmlFor="price">{isModificationTab ? t('edit.specs.priceMod') : t('edit.specs.priceSpec')}</Label>
            <Input id="price" name="price" type="number" step="0.01" value={specValue.price} onChange={handleSpecChange} disabled={fromInventory} />
            {isModificationTab && (
              <p className="text-xs text-muted-foreground">{t('edit.specs.priceModHint')}</p>
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
          <Label htmlFor="description">{t('edit.specs.description')}</Label>
          <Textarea id="description" name="description" rows={3} value={specValue.description} onChange={handleSpecChange} />
        </div>
        {!isModificationTab && (
          <div className="flex items-center space-x-2 mt-4">
            <Switch
              id="is_modification"
              checked={specValue.is_modification}
              onCheckedChange={(checked) => handleSpecChange({ target: { name: 'is_modification', value: '', type: 'checkbox', checked } })}
            />
            <Label htmlFor="is_modification">{t('edit.specs.isModification')}</Label>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <Button type="submit">
            {fromInventory
              ? t('edit.specs.mountAndDeduct')
              : editingSpec
                ? isModificationTab
                  ? t('edit.specs.updateModification')
                  : t('edit.specs.updateSpec')
                : isModificationTab
                  ? t('edit.specs.addModificationBtn')
                  : t('edit.specs.addSpecBtn')}
          </Button>
          {editingSpec && (
            <Button type="button" variant="secondary" onClick={handleCancelEdit}>
              {tCommon('actions.cancel')}
            </Button>
          )}
        </div>
      </form>
      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-4">
          {isModificationTab ? t('edit.specs.currentModifications') : t('edit.specs.currentSpecs')}
        </h4>
        {loadingSpecs ? (
          <Spinner className="size-6" />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('edit.specs.tableType')}</TableHead>
                  <TableHead>{t('edit.specs.element')}</TableHead>
                  <TableHead>{t('edit.specs.tableQty')}</TableHead>
                  <TableHead>{t('edit.specs.brand')}</TableHead>
                  <TableHead>{t('edit.specs.material')}</TableHead>
                  <TableHead>{t('edit.specs.size')}</TableHead>
                  <TableHead>{t('edit.specs.color')}</TableHead>
                  <TableHead>{t('edit.specs.tableUnitPrice')}</TableHead>
                  <TableHead>{t('edit.specs.tableLineTotal')}</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>{t('edit.specs.tableActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">
                      {isModificationTab ? t('edit.specs.noModifications') : t('edit.specs.noSpecs')}
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
                          <a href={comp.url} target="_blank" rel="noopener noreferrer" title={t('edit.openLink')} className="text-primary hover:underline">
                            <ExternalLink className="size-4 inline" />
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="default" size="sm" onClick={() => handleEditSpec(currentSpec, comp)} title={tCommon('actions.edit')}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteSpec(currentSpec.id, comp.id)} title={tCommon('actions.delete')}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isModificationTab && comp.change_history?.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="bg-muted/40 align-top py-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">{t('edit.specs.historyTitle')}</p>
                          <ul className="text-sm space-y-1 list-disc list-inside">
                            {comp.change_history.map((h) => (
                              <li key={h.id}>
                                <span className="text-muted-foreground">{t('edit.specs.historySince', { date: formatHistoryDate(h.effective_date) })} </span>
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
                      {t('edit.specs.totalModifications')}
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
}
