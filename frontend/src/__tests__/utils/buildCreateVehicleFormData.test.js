import { applyCatalogItemToVehicleForm } from '../../utils/catalogVehiclePrefill';
import {
  buildCreateVehicleFormData,
  resolveVehicleSaveSource,
} from '../../utils/buildCreateVehicleFormData';
import { emptyTechSpecForm } from '../../data/catalogTechSpecs';

const ITEM_ID = 'f837090b-c5a9-4749-a828-3d67a04f6b60';

const catalogItem = {
  id: ITEM_ID,
  model_name: 'Cadillac CTS-V Coupe',
  manufacturer: 'Scaleauto',
  reference: 'SC6378',
  vehicle_type: 'Turismo',
};

function blankVehicle(overrides = {}) {
  return {
    model: '',
    manufacturer: '',
    type: '',
    traction: '',
    motor_position: '',
    price: '',
    total_price: '',
    purchase_date: '',
    purchase_place: '',
    modified: false,
    digital: false,
    museo: false,
    taller: false,
    anotaciones: '',
    reference: '',
    scale_factor: 32,
    commercial_release_year: '',
    dorsal: '',
    limited_edition: false,
    limited_edition_unit_number: '',
    ...emptyTechSpecForm(),
    ...overrides,
  };
}

describe('buildCreateVehicleFormData — flujos de alta', () => {
  test('a) «Es este»: catalogItemId y vehicle.catalog_item_id no duplican el campo', () => {
    const typed = blankVehicle({
      model: 'Cadillac',
      manufacturer: 'Scaleauto',
      type: 'Turismo',
    });
    const afterSuggest = applyCatalogItemToVehicleForm(typed, catalogItem);
    const formData = buildCreateVehicleFormData(afterSuggest, {
      catalogItemId: catalogItem.id,
      source: resolveVehicleSaveSource({ catalogItemId: catalogItem.id, entryMode: 'manual' }),
    });
    expect(formData.getAll('catalog_item_id')).toEqual([ITEM_ID]);
    expect(formData.get('vehicle_save_source')).toBe('suggest');
    expect(formData.get('model')).toBe('Cadillac');
    expect(formData.get('manufacturer')).toBe('Scaleauto');
  });

  test('b) pestaña Catálogo y enlace ?catalogItemId= (mismo applyCatalogItem): un solo id y source catalog_tab', () => {
    const vehicle = blankVehicle({
      model: catalogItem.model_name,
      manufacturer: catalogItem.manufacturer,
      type: catalogItem.vehicle_type,
      reference: catalogItem.reference,
    });
    const formData = buildCreateVehicleFormData(vehicle, {
      catalogItemId: ITEM_ID,
      source: resolveVehicleSaveSource({ catalogItemId: ITEM_ID, entryMode: 'catalog' }),
    });
    expect(formData.getAll('catalog_item_id')).toEqual([ITEM_ID]);
    expect(formData.get('vehicle_save_source')).toBe('catalog_tab');
  });

  test('c) sin catálogo: catalog_item_id ausente y source manual', () => {
    const formData = buildCreateVehicleFormData(
      blankVehicle({ model: 'Libre', manufacturer: 'Ninco', type: 'GT' }),
      { source: resolveVehicleSaveSource({ catalogItemId: null, entryMode: 'manual' }) },
    );
    expect(formData.getAll('catalog_item_id')).toEqual([]);
    expect(formData.get('vehicle_save_source')).toBe('manual');
  });
});
