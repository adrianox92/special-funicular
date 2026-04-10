-- Marcas normalizadas: tabla slot_catalog_brands + FK manufacturer_id en ítems y colas.

CREATE TABLE IF NOT EXISTS public.slot_catalog_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS slot_catalog_brands_name_lower_idx
  ON public.slot_catalog_brands (lower(trim(name)));

-- Nombres distintos desde ítems (una fila por variante case-insensitive)
INSERT INTO public.slot_catalog_brands (name, created_at, updated_at)
SELECT DISTINCT ON (lower(trim(m.manufacturer)))
  trim(m.manufacturer) AS name,
  now(),
  now()
FROM public.slot_catalog_items m
WHERE m.manufacturer IS NOT NULL AND trim(m.manufacturer) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.slot_catalog_brands b
    WHERE lower(trim(b.name)) = lower(trim(m.manufacturer))
  )
ORDER BY lower(trim(m.manufacturer)), trim(m.manufacturer);

-- Nombres que solo aparecen en colas de alta pendientes/histórico
INSERT INTO public.slot_catalog_brands (name, created_at, updated_at)
SELECT DISTINCT ON (lower(trim(r.proposed_manufacturer)))
  trim(r.proposed_manufacturer) AS name,
  now(),
  now()
FROM public.slot_catalog_insert_requests r
WHERE r.proposed_manufacturer IS NOT NULL AND trim(r.proposed_manufacturer) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.slot_catalog_brands b
    WHERE lower(trim(b.name)) = lower(trim(r.proposed_manufacturer))
  )
ORDER BY lower(trim(r.proposed_manufacturer)), trim(r.proposed_manufacturer);

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid;

UPDATE public.slot_catalog_items i
SET manufacturer_id = b.id
FROM public.slot_catalog_brands b
WHERE i.manufacturer_id IS NULL
  AND i.manufacturer IS NOT NULL
  AND trim(i.manufacturer) <> ''
  AND lower(trim(i.manufacturer)) = lower(trim(b.name));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.slot_catalog_items WHERE manufacturer_id IS NULL) THEN
    RAISE EXCEPTION 'slot_catalog_brands: no se pudo asignar manufacturer_id a todos los ítems';
  END IF;
END $$;

ALTER TABLE public.slot_catalog_items
  ALTER COLUMN manufacturer_id SET NOT NULL;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_manufacturer_id_fkey;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_manufacturer_id_fkey
  FOREIGN KEY (manufacturer_id) REFERENCES public.slot_catalog_brands (id) ON DELETE RESTRICT;

-- La vista antigua referencia la columna manufacturer; hay que quitarla antes de DROP COLUMN.
DROP VIEW IF EXISTS public.slot_catalog_items_with_ratings CASCADE;

ALTER TABLE public.slot_catalog_items DROP CONSTRAINT IF EXISTS slot_catalog_items_reference_manufacturer_unique;

ALTER TABLE public.slot_catalog_items DROP COLUMN IF EXISTS manufacturer;

ALTER TABLE public.slot_catalog_items DROP CONSTRAINT IF EXISTS slot_catalog_items_reference_manufacturer_id_unique;
ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_reference_manufacturer_id_unique UNIQUE (reference, manufacturer_id);

DROP INDEX IF EXISTS public.idx_slot_catalog_items_manufacturer;
CREATE INDEX IF NOT EXISTS idx_slot_catalog_items_manufacturer_id ON public.slot_catalog_items (manufacturer_id);

ALTER TABLE public.slot_catalog_insert_requests
  ADD COLUMN IF NOT EXISTS proposed_manufacturer_id uuid;

UPDATE public.slot_catalog_insert_requests r
SET proposed_manufacturer_id = b.id
FROM public.slot_catalog_brands b
WHERE r.proposed_manufacturer_id IS NULL
  AND r.proposed_manufacturer IS NOT NULL
  AND trim(r.proposed_manufacturer) <> ''
  AND lower(trim(r.proposed_manufacturer)) = lower(trim(b.name));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.slot_catalog_insert_requests WHERE proposed_manufacturer_id IS NULL) THEN
    RAISE EXCEPTION 'slot_catalog_brands: no se pudo asignar proposed_manufacturer_id a todas las solicitudes';
  END IF;
END $$;

ALTER TABLE public.slot_catalog_insert_requests
  ALTER COLUMN proposed_manufacturer_id SET NOT NULL;

ALTER TABLE public.slot_catalog_insert_requests
  DROP CONSTRAINT IF EXISTS slot_catalog_insert_requests_proposed_manufacturer_id_fkey;

ALTER TABLE public.slot_catalog_insert_requests
  ADD CONSTRAINT slot_catalog_insert_requests_proposed_manufacturer_id_fkey
  FOREIGN KEY (proposed_manufacturer_id) REFERENCES public.slot_catalog_brands (id) ON DELETE RESTRICT;

ALTER TABLE public.slot_catalog_insert_requests DROP COLUMN IF EXISTS proposed_manufacturer;

DROP INDEX IF EXISTS public.idx_slot_catalog_insert_requests_one_pending_per_user_ref;
CREATE UNIQUE INDEX idx_slot_catalog_insert_requests_one_pending_per_user_ref
  ON public.slot_catalog_insert_requests (submitted_by, proposed_reference, proposed_manufacturer_id)
  WHERE status = 'pending';

CREATE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.manufacturer_id,
  b.name AS manufacturer,
  b.logo_url AS manufacturer_logo_url,
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
FROM public.slot_catalog_items i
JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id;

-- Resolver marca por nombre (trim + case-insensitive) desde la API / import
CREATE OR REPLACE FUNCTION public.slot_catalog_brand_id_by_name(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM public.slot_catalog_brands
  WHERE lower(trim(name)) = lower(trim(p_name))
  LIMIT 1;
$$;
