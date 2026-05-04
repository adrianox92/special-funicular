-- Enlaces opcionales a competición real (resultados y fotos) en ítems del catálogo

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS real_race_results_url text,
  ADD COLUMN IF NOT EXISTS real_race_photos_url text;

COMMENT ON COLUMN public.slot_catalog_items.real_race_results_url IS
  'URL a los resultados del vehículo real en la competición o prueba correspondiente.';
COMMENT ON COLUMN public.slot_catalog_items.real_race_photos_url IS
  'URL a fotos del vehículo real disputando esa prueba.';

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
