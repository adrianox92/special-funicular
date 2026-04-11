-- Usuarios distintos con al menos un vehículo enlazado a un ítem del catálogo (ficha pública).
CREATE OR REPLACE FUNCTION public.slot_catalog_item_registered_user_count(p_catalog_item_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(DISTINCT user_id)::integer, 0)
  FROM public.vehicles
  WHERE catalog_item_id = p_catalog_item_id;
$$;

REVOKE ALL ON FUNCTION public.slot_catalog_item_registered_user_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.slot_catalog_item_registered_user_count(uuid) TO anon, authenticated, service_role;
