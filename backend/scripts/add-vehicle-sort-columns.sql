-- Columnas y trigger para ordenar el listado de vehículos por último tiempo registrado y última modificación.
-- Ejecutar en Supabase SQL editor o vía migración.

-- last_timing_created_at: instante del último registro en vehicle_timings (por created_at del timing)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS last_timing_created_at timestamptz;

COMMENT ON COLUMN public.vehicles.last_timing_created_at IS 'MAX(vehicle_timings.created_at) para ordenar sin join; mantenido por trigger.';

-- updated_at para "última modificación" del ficha vehículo
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.vehicles
  ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.vehicles v
SET updated_at = COALESCE(v.updated_at, v.created_at)
WHERE v.updated_at IS NULL;

COMMENT ON COLUMN public.vehicles.updated_at IS 'Última actualización de la ficha del vehículo.';

-- Backfill last_timing_created_at desde tiempos existentes
UPDATE public.vehicles v
SET last_timing_created_at = s.mx
FROM (
  SELECT vehicle_id, MAX(created_at) AS mx
  FROM public.vehicle_timings
  GROUP BY vehicle_id
) s
WHERE v.id = s.vehicle_id;

CREATE INDEX IF NOT EXISTS idx_vehicles_last_timing_created_at ON public.vehicles (last_timing_created_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_updated_at ON public.vehicles (updated_at);

-- Función trigger: recalcula MAX(created_at) para el/los vehículo(s) afectados
CREATE OR REPLACE FUNCTION public.refresh_vehicle_last_timing_created_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  vid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    vid := OLD.vehicle_id;
    UPDATE public.vehicles v
    SET last_timing_created_at = (
      SELECT MAX(vt.created_at) FROM public.vehicle_timings vt WHERE vt.vehicle_id = vid
    )
    WHERE v.id = vid;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN
    UPDATE public.vehicles v
    SET last_timing_created_at = (
      SELECT MAX(vt.created_at) FROM public.vehicle_timings vt WHERE vt.vehicle_id = OLD.vehicle_id
    )
    WHERE v.id = OLD.vehicle_id;
  END IF;

  vid := NEW.vehicle_id;
  UPDATE public.vehicles v
  SET last_timing_created_at = (
    SELECT MAX(vt.created_at) FROM public.vehicle_timings vt WHERE vt.vehicle_id = vid
  )
  WHERE v.id = vid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehicle_timings_refresh_last_timing ON public.vehicle_timings;

CREATE TRIGGER trg_vehicle_timings_refresh_last_timing
  AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_timings
  FOR EACH ROW
  EXECUTE PROCEDURE public.refresh_vehicle_last_timing_created_at();
