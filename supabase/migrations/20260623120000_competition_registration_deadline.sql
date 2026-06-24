-- Fecha límite opcional para inscripciones públicas en competiciones

ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz;
