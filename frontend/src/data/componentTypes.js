/** Tipos de componente para especificaciones y modificaciones (etiquetas UI). */
export const vehicleComponentTypes = [
  { value: 'pinion', label: 'Piñón' },
  { value: 'crown', label: 'Corona' },
  { value: 'front_wheel', label: 'Neumático Delantero' },
  { value: 'rear_wheel', label: 'Neumático Trasero' },
  { value: 'front_rim', label: 'Llanta Delantera' },
  { value: 'rear_rim', label: 'Llanta Trasera' },
  { value: 'chassis', label: 'Chasis' },
  { value: 'other', label: 'Otros' },
  { value: 'rear_axle', label: 'Eje Trasero' },
  { value: 'front_axle', label: 'Eje Delantero' },
  { value: 'guide', label: 'Guía' },
  { value: 'motor', label: 'Motor' },
];

/** Única fuente de verdad: valor en BD → texto visible (inventario, exportaciones, dashboard). */
export const vehicleComponentTypeLabelMap = Object.fromEntries(
  vehicleComponentTypes.map((t) => [t.value, t.label]),
);

/**
 * @param {string|null|undefined} componentType
 * @returns {string}
 */
export function getVehicleComponentTypeLabel(componentType) {
  if (componentType == null || componentType === '') return '—';
  return vehicleComponentTypeLabelMap[componentType] ?? String(componentType);
}

/** Orden de categorías de inventario alineadas con tipos de vehículo (mismas etiquetas que arriba). */
export const inventoryVehicleCategoryValues = [
  'pinion',
  'crown',
  'motor',
  'guide',
  'chassis',
  'front_wheel',
  'rear_wheel',
  'front_rim',
  'rear_rim',
  'front_axle',
  'rear_axle',
];
