-- Marca y modelo del coche real, distintos de la marca de slot (manufacturer).
-- car_identity_source = manual evita que un guardado posterior reescriba una corrección.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS car_make text,
  ADD COLUMN IF NOT EXISTS car_model text,
  ADD COLUMN IF NOT EXISTS car_identity_source text;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_car_identity_source_check;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_car_identity_source_check
  CHECK (car_identity_source IS NULL OR car_identity_source IN ('auto', 'manual'));

COMMENT ON COLUMN public.slot_catalog_items.car_make IS
  'Marca del coche real (Toyota, Alfa Romeo). No es la marca de slot.';
COMMENT ON COLUMN public.slot_catalog_items.car_model IS
  'Familia de modelo del coche real (Yaris, 911, RS 5), sin dorsal ni decoración.';
COMMENT ON COLUMN public.slot_catalog_items.car_identity_source IS
  'auto: rellenado al guardar desde model_name. manual: no se vuelve a calcular.';

CREATE INDEX IF NOT EXISTS idx_slot_catalog_items_car_identity
  ON public.slot_catalog_items (car_make, car_model)
  WHERE car_make IS NOT NULL AND car_model IS NOT NULL;

CREATE OR REPLACE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.ean,
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
  i.spec_front_axle_length_mm,
  i.spec_rear_axle_length_mm,
  i.spec_weight_g,
  i.spec_magnet,
  i.spec_motor,
  i.spec_pinion_gear,
  i.spec_front_wheels,
  i.spec_rear_wheels,
  i.spec_front_rim,
  i.spec_rear_rim,
  i.spec_front_rim_diameter_mm,
  i.spec_rear_rim_diameter_mm,
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
  ) AS rating_count,
  i.car_make,
  i.car_model,
  i.car_identity_source
FROM public.slot_catalog_items i
JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id;

GRANT SELECT ON public.slot_catalog_items_with_ratings TO anon, authenticated, service_role;
