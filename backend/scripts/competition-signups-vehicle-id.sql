-- Script directo para Supabase SQL Editor.
-- Duplica el contenido de la migración 20260420120000_competition_signups_vehicle_id.sql
-- para poder ejecutarlo sin el CLI.

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
