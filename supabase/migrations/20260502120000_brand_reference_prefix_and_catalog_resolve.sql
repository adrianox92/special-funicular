-- Prefijo de referencia por marca + resolución de ítem de catálogo + enlace masivo admin

ALTER TABLE public.slot_catalog_brands
  ADD COLUMN IF NOT EXISTS reference_prefix text NULL;

COMMENT ON COLUMN public.slot_catalog_brands.reference_prefix IS
  'Prefijo opcional de referencia de catálogo (ej. AV). Se concatena con la referencia del usuario si no hay match exacto.';

-- Resuelve catalog_item_id: match exacto normalizado, luego prefijo+referencia si aplica.
CREATE OR REPLACE FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(
  p_brand_name text,
  p_user_reference text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
  v_prefix text;
  v_ref text;
  v_pref_trim text;
  v_id uuid;
  v_composed text;
BEGIN
  IF p_brand_name IS NULL OR trim(p_brand_name) = '' OR p_user_reference IS NULL OR trim(p_user_reference) = '' THEN
    RETURN NULL;
  END IF;

  v_ref := trim(p_user_reference);

  v_brand_id := slot_catalog_brand_id_by_name(p_brand_name);
  IF v_brand_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT b.reference_prefix INTO v_prefix
  FROM public.slot_catalog_brands b
  WHERE b.id = v_brand_id;

  SELECT i.id INTO v_id
  FROM public.slot_catalog_items i
  WHERE i.manufacturer_id = v_brand_id
    AND lower(trim(i.reference)) = lower(v_ref)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_pref_trim := NULLIF(trim(COALESCE(v_prefix, '')), '');

  IF v_pref_trim IS NULL THEN
    RETURN NULL;
  END IF;

  -- Evitar doble prefijo: la referencia ya empieza por el prefijo (case-insensitive)
  IF lower(v_ref) LIKE lower(v_pref_trim) || '%' THEN
    RETURN NULL;
  END IF;

  v_composed := v_pref_trim || v_ref;

  SELECT i.id INTO v_id
  FROM public.slot_catalog_items i
  WHERE i.manufacturer_id = v_brand_id
    AND lower(trim(i.reference)) = lower(trim(v_composed))
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(text, text) TO service_role;

-- Enlace masivo: solo vehículos sin catalog_item_id; filtro opcional por fabricante de garaje.
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
    updated_at = now()
  WHERE lower(trim(v.reference)) = lower(trim(p_garage_ref))
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
