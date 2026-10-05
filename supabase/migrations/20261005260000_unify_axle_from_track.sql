-- Unifica las dos medidas de eje en spec_*_axle_length_mm (formulario «Eje delantero/trasero»).
-- Copia vía (track) solo donde axle_length está vacío. No se eliminan columnas spec_*_track_mm.

UPDATE public.slot_catalog_items
SET spec_front_axle_length_mm = spec_front_track_mm
WHERE spec_front_axle_length_mm IS NULL
  AND spec_front_track_mm IS NOT NULL;

UPDATE public.slot_catalog_items
SET spec_rear_axle_length_mm = spec_rear_track_mm
WHERE spec_rear_axle_length_mm IS NULL
  AND spec_rear_track_mm IS NOT NULL;

UPDATE public.vehicles
SET spec_front_axle_length_mm = spec_front_track_mm
WHERE spec_front_axle_length_mm IS NULL
  AND spec_front_track_mm IS NOT NULL;

UPDATE public.vehicles
SET spec_rear_axle_length_mm = spec_rear_track_mm
WHERE spec_rear_axle_length_mm IS NULL
  AND spec_rear_track_mm IS NOT NULL;

COMMENT ON COLUMN public.slot_catalog_items.spec_front_axle_length_mm IS
  'Eje delantero en milímetros. Fuente de verdad del formulario (la vía legado spec_front_track_mm no se edita).';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_axle_length_mm IS
  'Eje trasero en milímetros. Fuente de verdad del formulario (la vía legado spec_rear_track_mm no se edita).';
COMMENT ON COLUMN public.vehicles.spec_front_axle_length_mm IS
  'Eje delantero en milímetros. Prefill desde catálogo si está vacío.';
COMMENT ON COLUMN public.vehicles.spec_rear_axle_length_mm IS
  'Eje trasero en milímetros. Prefill desde catálogo si está vacío.';

-- Al enlazar, axle_length vacío toma catálogo axle_length o, si falta, vía de catálogo.
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
    spec_front_axle_length_mm = COALESCE(
      v.spec_front_axle_length_mm,
      c.spec_front_axle_length_mm,
      c.spec_front_track_mm
    ),
    spec_rear_axle_length_mm = COALESCE(
      v.spec_rear_axle_length_mm,
      c.spec_rear_axle_length_mm,
      c.spec_rear_track_mm
    ),
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
