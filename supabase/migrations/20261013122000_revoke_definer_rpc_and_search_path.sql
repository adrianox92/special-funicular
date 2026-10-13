-- 1) handle_new_user: trigger de auth.users, no debe ser RPC público.
-- 2) slot_catalog_item_registered_user_count: SECURITY DEFINER que cuenta
--    usuarios con el ítem en el garaje. El catálogo público pasa a llamarla
--    con service_role (ver backend/routes/publicCatalog.js); se revoca a anon.
-- 3) is_club_*: se usan DENTRO de políticas RLS. Revocar EXECUTE a anon haría
--    fallar SELECT públicos/anon sobre clubs/members (permission denied for
--    function). Se mantienen para anon + authenticated; no se tocan.
-- 4) search_path mutable en funciones listadas por el advisor.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp';
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.slot_catalog_item_registered_user_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slot_catalog_item_registered_user_count(uuid)
  TO authenticated, service_role;

ALTER FUNCTION public.catalog_brand_slugify(text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.slot_catalog_brands_set_slug()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.refresh_vehicle_last_timing_created_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_competitions_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trg_promote_competition_on_first_timing()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.extract_dorsal_from_vehicle_model(text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.slot_catalog_brand_id_by_name(text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.assign_vehicle_collection_number()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.prevent_vehicle_collection_number_change()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_leagues_updated_at()
  SET search_path = public, pg_temp;
