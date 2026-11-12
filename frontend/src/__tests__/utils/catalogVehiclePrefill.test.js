import { applyCatalogItemToVehicleForm } from '../../utils/catalogVehiclePrefill';

const item = {
  id: '11111111-1111-4111-8111-111111111111',
  model_name: 'CUPRA León Competición',
  reference: 'U10522S300',
  manufacturer: 'Scaleauto',
  vehicle_type: 'Turismo',
  traction: '4x4',
  motor_position: 'inline',
  commercial_release_year: 2023,
  dorsal: '25',
  spec_body: 'Plastic',
};

describe('applyCatalogItemToVehicleForm', () => {
  test('rellena solo huecos y fija catalog_item_id', () => {
    const next = applyCatalogItemToVehicleForm(
      {
        model: 'Mi nombre',
        manufacturer: '',
        reference: '',
        type: '',
        traction: 'Trasera',
        spec_body: '',
      },
      item,
    );
    expect(next.catalog_item_id).toBe(item.id);
    expect(next.model).toBe('Mi nombre');
    expect(next.manufacturer).toBe('Scaleauto');
    expect(next.reference).toBe('U10522S300');
    expect(next.type).toBe('Turismo');
    expect(next.traction).toBe('Trasera');
    expect(next.spec_body).toBe('Plastic');
  });

  test('si los campos están intercambiados, los corrige y no pisa el texto del usuario', () => {
    const next = applyCatalogItemToVehicleForm(
      {
        model: 'U10522S300',
        reference: 'CUPRA LEÓN COMPETICIÓN - J. FILIPPI',
        manufacturer: '',
      },
      item,
    );
    expect(next.model).toBe('CUPRA LEÓN COMPETICIÓN - J. FILIPPI');
    expect(next.reference).toBe('U10522S300');
    expect(next.manufacturer).toBe('Scaleauto');
    expect(next.catalog_item_id).toBe(item.id);
  });
});
