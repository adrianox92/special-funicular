ALTER TABLE public.competitions
  ADD COLUMN laps_per_round integer CHECK (laps_per_round > 0);

COMMENT ON COLUMN public.competitions.laps_per_round IS
  'Vueltas objetivo por ronda. NULL = sin límite (modo libre)';
