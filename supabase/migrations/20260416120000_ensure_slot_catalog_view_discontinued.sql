-- Idempotente: asegura columnas en tablas y redefine la vista pública.
-- Corrige el error "column slot_catalog_items_with_ratings.discontinued does not exist"
-- si la migración anterior no llegó a ejecutarse por completo en el remoto.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS discontinued boolean NOT NULL DEFAULT false;

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS upcoming_release boolean NOT NULL DEFAULT false;

ALTER TABLE public.slot_catalog_insert_requests
  ADD COLUMN IF NOT EXISTS proposed_discontinued boolean NOT NULL DEFAULT false;

ALTER TABLE public.slot_catalog_insert_requests
  ADD COLUMN IF NOT EXISTS proposed_upcoming_release boolean NOT NULL DEFAULT false;

-- CREATE OR REPLACE falla al añadir columnas entre las existentes (42P16).
DROP VIEW IF EXISTS public.slot_catalog_items_with_ratings CASCADE;

CREATE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.manufacturer,
  i.model_name,
  i.vehicle_type,
  i.traction,
  i.motor_position,
  i.commercial_release_year,
  i.discontinued,
  i.upcoming_release,
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
FROM public.slot_catalog_items i;
