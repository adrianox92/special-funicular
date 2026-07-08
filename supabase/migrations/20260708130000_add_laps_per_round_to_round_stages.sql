ALTER TABLE public.competition_round_stages
  ADD COLUMN laps_per_round integer CHECK (laps_per_round > 0);

COMMENT ON COLUMN public.competition_round_stages.laps_per_round IS
  'Vueltas objetivo para este tramo. NULL = sin límite (usa laps_per_round de la competición o modo libre)';
