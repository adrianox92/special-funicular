-- Diámetro de llanta delantera/trasera (mm) en catálogo y vehículos de usuario.
-- Prefill catálogo→vehículo: copy-on-create / copy-on-link solo si el campo del vehículo está vacío.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS spec_front_rim_diameter_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_rear_rim_diameter_mm numeric;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_front_rim_diameter_mm_nonneg,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_rear_rim_diameter_mm_nonneg;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_spec_front_rim_diameter_mm_nonneg
    CHECK (spec_front_rim_diameter_mm IS NULL OR spec_front_rim_diameter_mm >= 0),
  ADD CONSTRAINT slot_catalog_items_spec_rear_rim_diameter_mm_nonneg
    CHECK (spec_rear_rim_diameter_mm IS NULL OR spec_rear_rim_diameter_mm >= 0);

COMMENT ON COLUMN public.slot_catalog_items.spec_front_rim_diameter_mm IS
  'Diámetro de llanta delantera en milímetros.';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_rim_diameter_mm IS
  'Diámetro de llanta trasera en milímetros.';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS spec_front_rim_diameter_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_rear_rim_diameter_mm numeric;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_spec_front_rim_diameter_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_rear_rim_diameter_mm_nonneg;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_spec_front_rim_diameter_mm_nonneg
    CHECK (spec_front_rim_diameter_mm IS NULL OR spec_front_rim_diameter_mm >= 0),
  ADD CONSTRAINT vehicles_spec_rear_rim_diameter_mm_nonneg
    CHECK (spec_rear_rim_diameter_mm IS NULL OR spec_rear_rim_diameter_mm >= 0);

COMMENT ON COLUMN public.vehicles.spec_front_rim_diameter_mm IS
  'Diámetro de llanta delantera en milímetros. Prefill desde catálogo si está vacío.';
COMMENT ON COLUMN public.vehicles.spec_rear_rim_diameter_mm IS
  'Diámetro de llanta trasera en milímetros. Prefill desde catálogo si está vacío.';

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
  ) AS rating_count
FROM public.slot_catalog_items i
JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id;

GRANT SELECT ON public.slot_catalog_items_with_ratings TO anon, authenticated, service_role;

-- Al enlazar desde admin, copia specs del catálogo solo en campos vacíos del vehículo.
CREATE OR REPLACE FUNCTION public.admin_link_vehicles_by_garage_ref_to_catalog_item(
  p_garage_ref text,
  p_garage_manufacturer text,
  p_catalog_item_id uuid
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  v_mfg_empty boolean;
BEGIN
  IF p_catalog_item_id IS NULL THEN
    RAISE EXCEPTION 'p_catalog_item_id requerido';
  END IF;
  IF p_garage_ref IS NULL OR trim(p_garage_ref) = '' THEN
    RAISE EXCEPTION 'p_garage_ref requerido';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.slot_catalog_items i WHERE i.id = p_catalog_item_id) THEN
    RAISE EXCEPTION 'Ítem de catálogo no encontrado';
  END IF;

  v_mfg_empty := p_garage_manufacturer IS NULL OR trim(p_garage_manufacturer) = '';

  UPDATE public.vehicles v
  SET
    catalog_item_id = p_catalog_item_id,
    spec_scale = COALESCE(v.spec_scale, c.spec_scale),
    spec_body = COALESCE(v.spec_body, c.spec_body),
    spec_color = COALESCE(v.spec_color, c.spec_color),
    spec_system = COALESCE(v.spec_system, c.spec_system),
    spec_length_mm = COALESCE(v.spec_length_mm, c.spec_length_mm),
    spec_height_mm = COALESCE(v.spec_height_mm, c.spec_height_mm),
    spec_wheelbase_mm = COALESCE(v.spec_wheelbase_mm, c.spec_wheelbase_mm),
    spec_front_track_mm = COALESCE(v.spec_front_track_mm, c.spec_front_track_mm),
    spec_rear_track_mm = COALESCE(v.spec_rear_track_mm, c.spec_rear_track_mm),
    spec_front_axle_width_mm = COALESCE(v.spec_front_axle_width_mm, c.spec_front_axle_width_mm),
    spec_rear_axle_width_mm = COALESCE(v.spec_rear_axle_width_mm, c.spec_rear_axle_width_mm),
    spec_weight_g = COALESCE(v.spec_weight_g, c.spec_weight_g),
    spec_magnet = COALESCE(v.spec_magnet, c.spec_magnet),
    spec_motor = COALESCE(v.spec_motor, c.spec_motor),
    spec_pinion_gear = COALESCE(v.spec_pinion_gear, c.spec_pinion_gear),
    spec_front_wheels = COALESCE(v.spec_front_wheels, c.spec_front_wheels),
    spec_rear_wheels = COALESCE(v.spec_rear_wheels, c.spec_rear_wheels),
    spec_front_rim = COALESCE(v.spec_front_rim, c.spec_front_rim),
    spec_rear_rim = COALESCE(v.spec_rear_rim, c.spec_rear_rim),
    spec_front_rim_diameter_mm = COALESCE(v.spec_front_rim_diameter_mm, c.spec_front_rim_diameter_mm),
    spec_rear_rim_diameter_mm = COALESCE(v.spec_rear_rim_diameter_mm, c.spec_rear_rim_diameter_mm),
    spec_front_lights = COALESCE(v.spec_front_lights, c.spec_front_lights),
    spec_rear_lights = COALESCE(v.spec_rear_lights, c.spec_rear_lights),
    updated_at = now()
  FROM public.slot_catalog_items c
  WHERE c.id = p_catalog_item_id
    AND lower(trim(v.reference)) = lower(trim(p_garage_ref))
    AND v.catalog_item_id IS NULL
    AND (
      v_mfg_empty
      OR lower(trim(COALESCE(v.manufacturer, ''))) = lower(trim(p_garage_manufacturer))
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_link_vehicles_by_garage_ref_to_catalog_item(text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_link_vehicles_by_garage_ref_to_catalog_item(text, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_link_vehicles_by_garage_ref_to_catalog_item(text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_vehicles_by_garage_ref_to_catalog_item(text, text, uuid) TO service_role;
