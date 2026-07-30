-- Número de colección estable por usuario (garage ID legible)

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS collection_number integer;

COMMENT ON COLUMN public.vehicles.collection_number IS
  'Número de colección estable e inmutable por usuario (1..N por orden de created_at). No se reutiliza al borrar.';

-- Backfill retroactivo: orden por fecha de alta, desempate por id
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS num
  FROM public.vehicles
  WHERE user_id IS NOT NULL
)
UPDATE public.vehicles v
SET collection_number = n.num
FROM numbered n
WHERE v.id = n.id;

-- user_id y collection_number van siempre juntos
ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_collection_number_user_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_collection_number_user_check
  CHECK (
    (user_id IS NULL AND collection_number IS NULL)
    OR (user_id IS NOT NULL AND collection_number IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_user_collection_number
  ON public.vehicles (user_id, collection_number)
  WHERE user_id IS NOT NULL AND collection_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_vehicle_collection_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.collection_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
    SELECT COALESCE(MAX(collection_number), 0) + 1
      INTO NEW.collection_number
      FROM public.vehicles
      WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_vehicle_collection_number_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.collection_number IS DISTINCT FROM NEW.collection_number THEN
    NEW.collection_number := OLD.collection_number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicles_assign_collection_number ON public.vehicles;
CREATE TRIGGER trg_vehicles_assign_collection_number
  BEFORE INSERT ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_vehicle_collection_number();

DROP TRIGGER IF EXISTS trg_vehicles_immutable_collection_number ON public.vehicles;
CREATE TRIGGER trg_vehicles_immutable_collection_number
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_vehicle_collection_number_change();
