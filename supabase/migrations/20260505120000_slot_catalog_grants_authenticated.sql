-- La API de catálogo usa JWT (rol authenticated) en PostgREST.
-- La vista slot_catalog_items_with_ratings ya tenía GRANT explícito a authenticated;
-- las tablas base no, así que /stats (slot_catalog_items), /brands y RPC de marca
-- podían fallar o quedar vacíos al dejar de usar solo la clave anon en el servidor.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_catalog_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_catalog_brands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_catalog_change_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_catalog_insert_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_catalog_ratings TO authenticated;

GRANT EXECUTE ON FUNCTION public.slot_catalog_brand_id_by_name(text) TO authenticated;
