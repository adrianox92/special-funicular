-- Comercialización: solo año (integer), no fecha completa.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'commercial_release_date'
  ) THEN
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS commercial_release_year integer;
    UPDATE public.vehicles SET commercial_release_year = EXTRACT(YEAR FROM commercial_release_date)::integer
      WHERE commercial_release_date IS NOT NULL;
    ALTER TABLE public.vehicles DROP COLUMN commercial_release_date;
  ELSE
    ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS commercial_release_year integer;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'slot_catalog_items' AND column_name = 'commercial_release_date'
  ) THEN
    ALTER TABLE public.slot_catalog_items ADD COLUMN IF NOT EXISTS commercial_release_year integer;
    UPDATE public.slot_catalog_items SET commercial_release_year = EXTRACT(YEAR FROM commercial_release_date)::integer
      WHERE commercial_release_date IS NOT NULL;
    ALTER TABLE public.slot_catalog_items DROP COLUMN commercial_release_date;
  ELSE
    ALTER TABLE public.slot_catalog_items ADD COLUMN IF NOT EXISTS commercial_release_year integer;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'slot_catalog_insert_requests' AND column_name = 'proposed_commercial_release_date'
  ) THEN
    ALTER TABLE public.slot_catalog_insert_requests ADD COLUMN IF NOT EXISTS proposed_commercial_release_year integer;
    UPDATE public.slot_catalog_insert_requests SET proposed_commercial_release_year = EXTRACT(YEAR FROM proposed_commercial_release_date)::integer
      WHERE proposed_commercial_release_date IS NOT NULL;
    ALTER TABLE public.slot_catalog_insert_requests DROP COLUMN proposed_commercial_release_date;
  ELSE
    ALTER TABLE public.slot_catalog_insert_requests ADD COLUMN IF NOT EXISTS proposed_commercial_release_year integer;
  END IF;
END $$;
