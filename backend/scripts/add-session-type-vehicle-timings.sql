-- Tipo de sesión para tiempos sincronizados desde DS200 u otros clientes.
-- Ejecutar en Supabase SQL Editor.
--
-- HEAT = manga/carrera en contexto de campeonato; TRAINING = entrenamiento.

ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS session_type text;

ALTER TABLE public.vehicle_timings
DROP CONSTRAINT IF EXISTS vehicle_timings_session_type_check;

ALTER TABLE public.vehicle_timings
ADD CONSTRAINT vehicle_timings_session_type_check
CHECK (session_type IS NULL OR session_type IN ('HEAT', 'TRAINING'));

COMMENT ON COLUMN public.vehicle_timings.session_type IS 'HEAT = manga (campeonato); TRAINING = entrenamiento. NULL = legacy o no indicado.';
