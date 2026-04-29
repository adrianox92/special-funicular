-- Dorsal y edición limitada (garage + catálogo)

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS dorsal text,
  ADD COLUMN IF NOT EXISTS limited_edition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limited_edition_unit_number integer;

COMMENT ON COLUMN public.vehicles.dorsal IS 'Número o texto de dorsal en competición';
COMMENT ON COLUMN public.vehicles.limited_edition IS 'Si el ejemplar es de edición limitada';
COMMENT ON COLUMN public.vehicles.limited_edition_unit_number IS 'Nº del ejemplar que posee el usuario (p. ej. 45 de una tirada)';

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS dorsal text,
  ADD COLUMN IF NOT EXISTS limited_edition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS limited_edition_total integer;

COMMENT ON COLUMN public.slot_catalog_items.dorsal IS 'Dorsal habitual del modelo en catálogo';
COMMENT ON COLUMN public.slot_catalog_items.limited_edition IS 'Modelo comercializado como edición limitada';
COMMENT ON COLUMN public.slot_catalog_items.limited_edition_total IS 'Unidades totales comercializadas si edición limitada';

ALTER TABLE public.slot_catalog_insert_requests
  ADD COLUMN IF NOT EXISTS proposed_dorsal text,
  ADD COLUMN IF NOT EXISTS proposed_limited_edition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposed_limited_edition_total integer;

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
