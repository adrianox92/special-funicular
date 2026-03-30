/** Tipos de componente para especificaciones y modificaciones (etiquetas UI). */
export const vehicleComponentTypes = [
  { value: 'pinion', label: 'Piñón' },
  { value: 'crown', label: 'Corona' },
  { value: 'front_wheel', label: 'Neumático Delantero' },
  { value: 'rear_wheel', label: 'Neumático Trasero' },
  { value: 'front_rim', label: 'Llanta Delantera' },
  { value: 'rear_rim', label: 'Llanta Trasera' },
  { value: 'axle', label: 'Ejes' },
  { value: 'chassis', label: 'Chasis' },
  { value: 'other', label: 'Otros' },
  { value: 'guide', label: 'Guía' },
  { value: 'motor', label: 'Motor' },
  { value: 'trencillas', label: 'Trencillas' },
  { value: 'tornillos', label: 'Tornillos' },
  { value: 'stoppers', label: 'Stoppers' },
  { value: 'topes_y_centradores', label: 'Topes y centradores' },
  { value: 'cojinetes', label: 'Cojinetes' },
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
  if (componentType === 'front_axle' || componentType === 'rear_axle') {
    return vehicleComponentTypeLabelMap.axle;
  }
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
  'axle',
];
