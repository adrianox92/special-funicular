-- Color, sistema y anchos de ejes en fichas de catálogo (fase 1, extensión).
-- traction y motor_position no se duplican; fase 2 (vehicles) fuera de alcance.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS spec_color text,
  ADD COLUMN IF NOT EXISTS spec_system text,
  ADD COLUMN IF NOT EXISTS spec_front_axle_width_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_rear_axle_width_mm numeric;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_front_axle_width_mm_nonneg,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_rear_axle_width_mm_nonneg;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_spec_front_axle_width_mm_nonneg
    CHECK (spec_front_axle_width_mm IS NULL OR spec_front_axle_width_mm >= 0),
  ADD CONSTRAINT slot_catalog_items_spec_rear_axle_width_mm_nonneg
    CHECK (spec_rear_axle_width_mm IS NULL OR spec_rear_axle_width_mm >= 0);

COMMENT ON COLUMN public.slot_catalog_items.spec_color IS 'Color (texto libre, p. ej. Black).';
COMMENT ON COLUMN public.slot_catalog_items.spec_system IS 'Sistema / compatibilidad (p. ej. Analog, Digital Plug Ready).';
COMMENT ON COLUMN public.slot_catalog_items.spec_front_axle_width_mm IS 'Ancho de ejes delantero en milímetros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_axle_width_mm IS 'Ancho de ejes trasero en milímetros.';

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
  i.spec_lights,
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
