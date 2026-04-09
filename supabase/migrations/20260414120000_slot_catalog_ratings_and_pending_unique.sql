-- Valoraciones 1–5 por ítem de catálogo; un solo cambio pendiente por usuario e ítem.

CREATE TABLE IF NOT EXISTS public.slot_catalog_ratings (
  catalog_item_id uuid NOT NULL REFERENCES public.slot_catalog_items (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_catalog_ratings_pkey PRIMARY KEY (catalog_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_slot_catalog_ratings_catalog_item_id ON public.slot_catalog_ratings (catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_slot_catalog_ratings_user_id ON public.slot_catalog_ratings (user_id);

-- Un solo cambio pendiente por usuario e ítem (evita spam en cola).
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_catalog_change_requests_one_pending_per_user_item
  ON public.slot_catalog_change_requests (catalog_item_id, submitted_by)
  WHERE status = 'pending';

-- Un solo alta pendiente por usuario + ref + marca (misma semántica que unicidad del catálogo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_catalog_insert_requests_one_pending_per_user_ref
  ON public.slot_catalog_insert_requests (submitted_by, proposed_reference, proposed_manufacturer)
  WHERE status = 'pending';

-- Vista: mismas columnas que slot_catalog_items + agregados de valoración.
CREATE OR REPLACE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.manufacturer,
  i.model_name,
  i.vehicle_type,
  i.traction,
  i.motor_position,
  i.commercial_release_year,
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
