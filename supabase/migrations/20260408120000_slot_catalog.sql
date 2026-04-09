-- Catálogo colaborativo slot + extensiones vehículos
-- Ejecutar en Supabase SQL Editor o vía CLI si migras.

CREATE TABLE IF NOT EXISTS public.slot_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  manufacturer text NOT NULL,
  model_name text NOT NULL,
  commercial_release_date date,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_catalog_items_reference_unique UNIQUE (reference)
);

CREATE INDEX IF NOT EXISTS idx_slot_catalog_items_manufacturer ON public.slot_catalog_items (manufacturer);

CREATE TABLE IF NOT EXISTS public.slot_catalog_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.slot_catalog_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proposed_patch jsonb NOT NULL DEFAULT '{}',
  submitted_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slot_catalog_change_requests_status ON public.slot_catalog_change_requests (status);

CREATE TABLE IF NOT EXISTS public.slot_catalog_insert_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_reference text NOT NULL,
  proposed_manufacturer text NOT NULL,
  proposed_model_name text NOT NULL,
  proposed_commercial_release_date date,
  proposed_image_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_catalog_item_id uuid REFERENCES public.slot_catalog_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slot_catalog_insert_requests_status ON public.slot_catalog_insert_requests (status);

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS commercial_release_date date;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS catalog_item_id uuid REFERENCES public.slot_catalog_items(id) ON DELETE SET NULL;

-- Bucket público para imágenes del catálogo (la API sube con la clave de servicio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;
