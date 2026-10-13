-- La vista slot_catalog_items_with_ratings se ejecutaba como SECURITY DEFINER
-- (bypass RLS de items/ratings). El catálogo público (~2.900 lecturas/día) la usa
-- con el cliente anon, así que ANTES de activar security_invoker hay que permitir
-- SELECT a anon/authenticated en las tablas base. Sin esas políticas la vista
-- devolvería 0 filas.
--
-- slot_catalog_items tiene RLS y, según el advisor, ninguna política: hoy solo
-- es legible vía la vista definer o service_role.

ALTER TABLE public.slot_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_catalog_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slot_catalog_items_public_select ON public.slot_catalog_items;
CREATE POLICY slot_catalog_items_public_select
  ON public.slot_catalog_items
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS slot_catalog_ratings_public_select ON public.slot_catalog_ratings;
CREATE POLICY slot_catalog_ratings_public_select
  ON public.slot_catalog_ratings
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.slot_catalog_items TO anon, authenticated;
GRANT SELECT ON TABLE public.slot_catalog_ratings TO anon, authenticated;
GRANT SELECT ON TABLE public.slot_catalog_brands TO anon, authenticated;

ALTER VIEW public.slot_catalog_items_with_ratings SET (security_invoker = true);
