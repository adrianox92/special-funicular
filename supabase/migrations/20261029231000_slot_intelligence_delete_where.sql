-- La base tiene safeupdate: un DELETE sin WHERE falla con
-- "DELETE requires a WHERE clause" al recalcular la foto.
-- Las claves son NOT NULL, así que el predicado vacía las tablas igual que antes.
-- Si la función ya trae el WHERE (instalación nueva), no se toca.

DO $patch$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'slot_intelligence_refresh'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF def IS NULL THEN
    RAISE EXCEPTION 'slot_intelligence_refresh no existe';
  END IF;

  IF strpos(def, 'DELETE FROM public.slot_intelligence_items;') = 0 THEN
    RETURN;
  END IF;

  def := replace(def, 'DELETE FROM public.slot_intelligence_items;',
    'DELETE FROM public.slot_intelligence_items WHERE catalog_item_id IS NOT NULL;');
  def := replace(def, 'DELETE FROM public.slot_intelligence_brands;',
    'DELETE FROM public.slot_intelligence_brands WHERE manufacturer_id IS NOT NULL;');
  def := replace(def, 'DELETE FROM public.slot_intelligence_purchase_places;',
    'DELETE FROM public.slot_intelligence_purchase_places WHERE id IS NOT NULL;');
  def := replace(def, 'DELETE FROM public.slot_intelligence_summary;',
    'DELETE FROM public.slot_intelligence_summary WHERE id IS NOT NULL;');

  IF strpos(def, 'DELETE FROM public.slot_intelligence_items WHERE catalog_item_id IS NOT NULL;') = 0 THEN
    RAISE EXCEPTION 'No se ha podido parchear slot_intelligence_refresh';
  END IF;

  EXECUTE def;
END
$patch$;
