-- Permite que un miembro del club que se inscribe a una competición
-- referencie un vehículo de su propia colección, sin depender únicamente
-- del texto libre. El campo `vehicle` (texto) se mantiene por compatibilidad
-- con las inscripciones públicas sin autenticación.

ALTER TABLE public.competition_signups
  ADD COLUMN IF NOT EXISTS vehicle_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'competition_signups_vehicle_id_fkey'
  ) THEN
    ALTER TABLE public.competition_signups
      ADD CONSTRAINT competition_signups_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES public.vehicles (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_competition_signups_vehicle_id
  ON public.competition_signups (vehicle_id);
