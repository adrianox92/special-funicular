-- Especificaciones técnicas de ficha en vehículos de usuario (fase 2).
-- Mismos nombres/tipos que slot_catalog_items (spec_*), sin traction/motor_position.
-- Prefill desde catálogo: copy-on-create / copy-on-link de campos vacíos (COALESCE).

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS spec_scale text,
  ADD COLUMN IF NOT EXISTS spec_body text,
  ADD COLUMN IF NOT EXISTS spec_color text,
  ADD COLUMN IF NOT EXISTS spec_system text,
  ADD COLUMN IF NOT EXISTS spec_length_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_height_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_wheelbase_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_front_track_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_rear_track_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_front_axle_width_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_rear_axle_width_mm numeric,
  ADD COLUMN IF NOT EXISTS spec_weight_g numeric,
  ADD COLUMN IF NOT EXISTS spec_magnet boolean,
  ADD COLUMN IF NOT EXISTS spec_motor text,
  ADD COLUMN IF NOT EXISTS spec_pinion_gear text,
  ADD COLUMN IF NOT EXISTS spec_front_wheels text,
  ADD COLUMN IF NOT EXISTS spec_rear_wheels text,
  ADD COLUMN IF NOT EXISTS spec_front_rim text,
  ADD COLUMN IF NOT EXISTS spec_rear_rim text,
  ADD COLUMN IF NOT EXISTS spec_front_lights boolean,
  ADD COLUMN IF NOT EXISTS spec_rear_lights boolean;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_spec_length_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_height_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_wheelbase_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_front_track_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_rear_track_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_front_axle_width_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_rear_axle_width_mm_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_weight_g_nonneg,
  DROP CONSTRAINT IF EXISTS vehicles_spec_system_check,
  DROP CONSTRAINT IF EXISTS vehicles_spec_front_rim_check,
  DROP CONSTRAINT IF EXISTS vehicles_spec_rear_rim_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_spec_length_mm_nonneg
    CHECK (spec_length_mm IS NULL OR spec_length_mm >= 0),
  ADD CONSTRAINT vehicles_spec_height_mm_nonneg
    CHECK (spec_height_mm IS NULL OR spec_height_mm >= 0),
  ADD CONSTRAINT vehicles_spec_wheelbase_mm_nonneg
    CHECK (spec_wheelbase_mm IS NULL OR spec_wheelbase_mm >= 0),
  ADD CONSTRAINT vehicles_spec_front_track_mm_nonneg
    CHECK (spec_front_track_mm IS NULL OR spec_front_track_mm >= 0),
  ADD CONSTRAINT vehicles_spec_rear_track_mm_nonneg
    CHECK (spec_rear_track_mm IS NULL OR spec_rear_track_mm >= 0),
  ADD CONSTRAINT vehicles_spec_front_axle_width_mm_nonneg
    CHECK (spec_front_axle_width_mm IS NULL OR spec_front_axle_width_mm >= 0),
  ADD CONSTRAINT vehicles_spec_rear_axle_width_mm_nonneg
    CHECK (spec_rear_axle_width_mm IS NULL OR spec_rear_axle_width_mm >= 0),
  ADD CONSTRAINT vehicles_spec_weight_g_nonneg
    CHECK (spec_weight_g IS NULL OR spec_weight_g >= 0),
  ADD CONSTRAINT vehicles_spec_system_check
    CHECK (spec_system IS NULL OR spec_system IN ('analog', 'digital')),
  ADD CONSTRAINT vehicles_spec_front_rim_check
    CHECK (spec_front_rim IS NULL OR spec_front_rim IN ('plastic', 'aluminum', 'magnesium')),
  ADD CONSTRAINT vehicles_spec_rear_rim_check
    CHECK (spec_rear_rim IS NULL OR spec_rear_rim IN ('plastic', 'aluminum', 'magnesium'));

COMMENT ON COLUMN public.vehicles.spec_scale IS 'Escala (p. ej. 1:32). Prefill desde catálogo si está vacío.';
COMMENT ON COLUMN public.vehicles.spec_body IS 'Material de carrocería (p. ej. Plastic).';
COMMENT ON COLUMN public.vehicles.spec_color IS 'Color (texto libre, p. ej. Black).';
COMMENT ON COLUMN public.vehicles.spec_system IS 'Sistema: analog | digital | NULL. Etiquetas i18n en el cliente.';
COMMENT ON COLUMN public.vehicles.spec_length_mm IS 'Longitud en milímetros.';
COMMENT ON COLUMN public.vehicles.spec_height_mm IS 'Altura en milímetros.';
COMMENT ON COLUMN public.vehicles.spec_wheelbase_mm IS 'Batalla / distancia entre ejes en milímetros.';
COMMENT ON COLUMN public.vehicles.spec_front_track_mm IS 'Vía delantera en milímetros.';
COMMENT ON COLUMN public.vehicles.spec_rear_track_mm IS 'Vía trasera en milímetros.';
COMMENT ON COLUMN public.vehicles.spec_front_axle_width_mm IS 'Ancho de ejes delantero en milímetros.';
COMMENT ON COLUMN public.vehicles.spec_rear_axle_width_mm IS 'Ancho de ejes trasero en milímetros.';
COMMENT ON COLUMN public.vehicles.spec_weight_g IS 'Peso en gramos.';
COMMENT ON COLUMN public.vehicles.spec_magnet IS 'Si el ejemplar incluye imán. NULL = no especificado.';
COMMENT ON COLUMN public.vehicles.spec_motor IS 'Motor (texto libre, p. ej. S-Can 18,000rpm).';
COMMENT ON COLUMN public.vehicles.spec_pinion_gear IS 'Piñón / corona (p. ej. 9/27).';
COMMENT ON COLUMN public.vehicles.spec_front_wheels IS 'Ruedas delanteras.';
COMMENT ON COLUMN public.vehicles.spec_rear_wheels IS 'Ruedas traseras.';
COMMENT ON COLUMN public.vehicles.spec_front_rim IS
  'Llanta delantera: plastic | aluminum | magnesium | NULL. Etiquetas i18n en el cliente.';
COMMENT ON COLUMN public.vehicles.spec_rear_rim IS
  'Llanta trasera: plastic | aluminum | magnesium | NULL. Etiquetas i18n en el cliente.';
COMMENT ON COLUMN public.vehicles.spec_front_lights IS
  'Luces delanteras. true = sí; false/NULL = no o no especificado (ficha oculta).';
COMMENT ON COLUMN public.vehicles.spec_rear_lights IS
  'Luces traseras. true = sí; false/NULL = no o no especificado (ficha oculta).';

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
