-- Unifica front_axle y rear_axle en el tipo axle (etiqueta UI: Ejes).
-- Ejecutar en Supabase SQL Editor una vez tras desplegar el código que usa 'axle'.
--
-- Tablas tocadas: components, inventory_items, component_modification_history,
-- vehicle_timings, competition_timings (snapshots JSON con component_type).

BEGIN;

UPDATE public.components
SET component_type = 'axle'
WHERE component_type IN ('front_axle', 'rear_axle');

UPDATE public.inventory_items
SET category = 'axle'
WHERE category IN ('front_axle', 'rear_axle');

UPDATE public.component_modification_history
SET previous_snapshot = jsonb_set(
  COALESCE(previous_snapshot, '{}'::jsonb),
  '{component_type}',
  to_jsonb('axle'::text),
  true
)
WHERE previous_snapshot->>'component_type' IN ('front_axle', 'rear_axle');

-- Snapshots de configuración (texto JSON o jsonb): normaliza espacios opcionales tras ':'.
UPDATE public.vehicle_timings
SET setup_snapshot = regexp_replace(
  regexp_replace(
    setup_snapshot::text,
    '"component_type"\s*:\s*"front_axle"',
    '"component_type":"axle"',
    'g'
  ),
  '"component_type"\s*:\s*"rear_axle"',
  '"component_type":"axle"',
  'g'
)
WHERE setup_snapshot IS NOT NULL
  AND (
    setup_snapshot::text ~ 'front_axle'
    OR setup_snapshot::text ~ 'rear_axle'
  );

UPDATE public.competition_timings
SET setup_snapshot = regexp_replace(
  regexp_replace(
    setup_snapshot::text,
    '"component_type"\s*:\s*"front_axle"',
    '"component_type":"axle"',
    'g'
  ),
  '"component_type"\s*:\s*"rear_axle"',
  '"component_type":"axle"',
  'g'
)
WHERE setup_snapshot IS NOT NULL
  AND (
    setup_snapshot::text ~ 'front_axle'
    OR setup_snapshot::text ~ 'rear_axle'
  );

COMMIT;
