-- Especificaciones técnicas de ficha de catálogo (fase 1).
-- Columnas nuevas en slot_catalog_items; traction y motor_position no se duplican.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS spec_scale text,
  ADD COLUMN IF NOT EXISTS spec_body text,
  ADD COLUMN IF NOT EXISTS spec_length_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_height_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_wheelbase_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_front_track_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_rear_track_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_weight_g numeric,
  ADD COLUMN IF NOT EXISTS spec_magnet boolean,
  ADD COLUMN IF NOT EXISTS spec_motor text,
  ADD COLUMN IF NOT EXISTS spec_pinion_gear text,
  ADD COLUMN IF NOT EXISTS spec_front_wheels text,
  ADD COLUMN IF NOT EXISTS spec_rear_wheels text,
  ADD COLUMN IF NOT EXISTS spec_front_tyres text,
  ADD COLUMN IF NOT EXISTS spec_rear_tyres text,
  ADD COLUMN IF NOT EXISTS spec_lights text;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_length_mm_nonneg,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_height_mm_nonneg,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_wheelbase_mm_nonneg,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_front_track_mm_nonneg,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_rear_track_mm_nonneg,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_weight_g_nonneg;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_spec_length_mm_nonneg
    CHECK (spec_length_mm IS NULL OR spec_length_mm >= 0),
  ADD CONSTRAINT slot_catalog_items_spec_height_mm_nonneg
    CHECK (spec_height_mm IS NULL OR spec_height_mm >= 0),
  ADD CONSTRAINT slot_catalog_items_spec_wheelbase_mm_nonneg
    CHECK (spec_wheelbase_mm IS NULL OR spec_wheelbase_mm >= 0),
  ADD CONSTRAINT slot_catalog_items_spec_front_track_mm_nonneg
    CHECK (spec_front_track_mm IS NULL OR spec_front_track_mm >= 0),
  ADD CONSTRAINT slot_catalog_items_spec_rear_track_mm_nonneg
    CHECK (spec_rear_track_mm IS NULL OR spec_rear_track_mm >= 0),
  ADD CONSTRAINT slot_catalog_items_spec_weight_g_nonneg
    CHECK (spec_weight_g IS NULL OR spec_weight_g >= 0);

COMMENT ON COLUMN public.slot_catalog_items.spec_scale IS 'Escala (p. ej. 1:32).';
COMMENT ON COLUMN public.slot_catalog_items.spec_body IS 'Material de carrocería (p. ej. Plastic).';
COMMENT ON COLUMN public.slot_catalog_items.spec_length_mm IS 'Longitud en milímetros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_height_mm IS 'Altura en milímetros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_wheelbase_mm IS 'Batalla / distancia entre ejes en milímetros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_front_track_mm IS 'Vía delantera en milímetros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_track_mm IS 'Vía trasera en milímetros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_weight_g IS 'Peso en gramos.';
COMMENT ON COLUMN public.slot_catalog_items.spec_magnet IS 'Si el modelo incluye imán. NULL = no especificado.';
COMMENT ON COLUMN public.slot_catalog_items.spec_motor IS 'Motor (texto libre, p. ej. S-Can 18,000rpm).';
COMMENT ON COLUMN public.slot_catalog_items.spec_pinion_gear IS 'Piñón / corona (p. ej. 9/27).';
COMMENT ON COLUMN public.slot_catalog_items.spec_front_wheels IS 'Ruedas delanteras.';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_wheels IS 'Ruedas traseras.';
COMMENT ON COLUMN public.slot_catalog_items.spec_front_tyres IS 'Neumáticos delanteros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_tyres IS 'Neumáticos traseros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_lights IS 'Luces (p. ej. Front & Rear).';

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
  i.spec_length_mm,
  i.spec_height_mm,
  i.spec_wheelbase_mm,
  i.spec_front_track_mm,
  i.spec_rear_track_mm,
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
