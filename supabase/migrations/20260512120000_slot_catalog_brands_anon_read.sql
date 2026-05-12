-- GET /public/catalog/brands y facetas usan getAnonClient() (rol anon en PostgREST).
-- Tras 20260505120000 solo authenticated tenía SELECT en slot_catalog_brands;
-- anon podía leer la vista slot_catalog_items_with_ratings pero no la tabla de marcas,
-- así que el listado de marcas quedaba vacío o fallaba según privilegios.

GRANT SELECT ON public.slot_catalog_brands TO anon;
