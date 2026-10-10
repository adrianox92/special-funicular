-- Luces delanteras/traseras (boolean) y sistema analog/digital.
-- Partición aditiva de spec_lights; spec_system pasa a claves neutras.
-- traction y motor_position no se duplican; fase 2 (vehicles) fuera de alcance.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS spec_front_lights boolean,
  ADD COLUMN IF NOT EXISTS spec_rear_lights boolean;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slot_catalog_items'
      AND column_name = 'spec_lights'
  ) THEN
    UPDATE public.slot_catalog_items
    SET
      spec_front_lights = CASE
        WHEN spec_lights ~* '(front|delant|vorn)' THEN true
        ELSE spec_front_lights
      END,
      spec_rear_lights = CASE
        WHEN spec_lights ~* '(rear|traser|hinten|r[uü]ck)' THEN true
        ELSE spec_rear_lights
      END
    WHERE spec_lights IS NOT NULL AND btrim(spec_lights) <> '';
  END IF;
END $$;

UPDATE public.slot_catalog_items
SET spec_system = CASE
  WHEN spec_system IS NULL OR btrim(spec_system) = '' THEN NULL
  WHEN lower(btrim(spec_system)) IN (
    'analog',
    'analogue',
    'analógico',
    'analogico',
    'analogisch'
  ) THEN 'analog'
  WHEN lower(btrim(spec_system)) = 'digital' THEN 'digital'
  ELSE NULL
END
WHERE spec_system IS NOT NULL;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_system_check;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_spec_system_check
    CHECK (spec_system IS NULL OR spec_system IN ('analog', 'digital'));

COMMENT ON COLUMN public.slot_catalog_items.spec_front_lights IS
  'Luces delanteras. true = sí; false/NULL = no o no especificado (ficha pública oculta).';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_lights IS
  'Luces traseras. true = sí; false/NULL = no o no especificado (ficha pública oculta).';
COMMENT ON COLUMN public.slot_catalog_items.spec_system IS
  'Sistema: analog | digital | NULL. Etiquetas i18n en el cliente.';

DROP VIEW IF EXISTS public.slot_catalog_items_with_ratings CASCADE;

CREATE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.manufacturer_id,
  b.name          AS manufacturer,
  b.logo_url      AS manufacturer_logo_url,
  b.slug          AS manufacturer_slug,
  i.model_name,
  i.vehicle_type,
  i.traction,
  i.motor_position,
  i.commercial_release_year,
  i.discontinued,
  i.upcoming_release,
  i.dorsal,
  i.limited_edition,
  i.limited_edition_total,
  i.real_race_results_url,
  i.real_race_photos_url,
  i.spec_scale,
  i.spec_body,
  i.spec_color,
  i.spec_system,
  i.spec_length_mm,
  i.spec_height_mm,
  i.spec_wheelbase_mm,
  i.spec_front_track_mm,
  i.spec_rear_track_mm,
  i.spec_front_axle_width_mm,
  i.spec_rear_axle_width_mm,
  i.spec_weight_g,
  i.spec_magnet,
  i.spec_motor,
  i.spec_pinion_gear,
  i.spec_front_wheels,
  i.spec_rear_wheels,
  i.spec_front_tyres,
  i.spec_rear_tyres,
  i.spec_front_lights,
  i.spec_rear_lights,
  i.image_url,
  i.created_at,
  i.updated_at,
  (
    SELECT COALESCE(ROUND(AVG(r.rating)::numeric, 2), NULL)
    FROM public.slot_catalog_ratings r
    WHERE r.catalog_item_id = i.id
  ) AS rating_avg,
  (
    SELECT COUNT(*)::bigint
    FROM public.slot_catalog_ratings r2
    WHERE r2.catalog_item_id = i.id
  ) AS rating_count
FROM public.slot_catalog_items i
JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id;

GRANT SELECT ON public.slot_catalog_items_with_ratings TO anon, authenticated, service_role;

ALTER TABLE public.slot_catalog_items
  DROP COLUMN IF EXISTS spec_lights;
