ALTER TABLE public.vehicle_timings
  ADD COLUMN IF NOT EXISTS guided_session jsonb;

COMMENT ON COLUMN public.vehicle_timings.guided_session IS
  'Métricas de entrenamiento guiado: baseline, target, lapsOnTarget, bestImprovementMs';
