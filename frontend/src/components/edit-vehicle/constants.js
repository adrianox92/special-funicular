export const IMAGE_FIELD_NAMES = ['front', 'left', 'right', 'rear', 'top', 'chassis', 'three_quarters'];

export const viewTypeMap = {
  'Delantera': 'front',
  'Perfil Izquierdo': 'left',
  'Perfil Derecho': 'right',
  'Trasera': 'rear',
  'Superior': 'top',
  'Chasis': 'chassis',
  'Vista 3/4': 'three_quarters',
  'front': 'front',
  'left': 'left',
  'right': 'right',
  'rear': 'rear',
  'top': 'top',
  'chassis': 'chassis',
  'three_quarters': 'three_quarters',
};

export const EMPTY_SPEC = {
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
  mounted_qty: '1',
  is_modification: false,
};

export const emptyTiming = () => ({
  best_lap_time: '',
  total_time: '',
  laps: '',
  average_time: '',
  lane: '',
  circuit: '',
  circuit_id: '',
  timing_date: new Date().toISOString().split('T')[0],
  best_lap_timestamp: null,
  total_time_timestamp: null,
  average_time_timestamp: null,
  supply_voltage_volts: '',
});

export const VEHICLE_TABS_TRIGGER_CLASS = 'sm:px-3 sm:text-sm';
