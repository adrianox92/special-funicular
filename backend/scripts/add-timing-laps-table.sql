-- Script para añadir tabla timing_laps y campos de consistencia en vehicle_timings
-- Ejecutar en Supabase SQL Editor
--
-- timing_laps: almacena cada vuelta individual de una sesión
-- consistency_score: coeficiente de variación (std_dev/mean × 100) - menor = más consistente
-- worst_lap_timestamp: tiempo de la peor vuelta en segundos

-- ========== TABLA TIMING_LAPS ==========
CREATE TABLE IF NOT EXISTS public.timing_laps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timing_id uuid NOT NULL REFERENCES public.vehicle_timings(id) ON DELETE CASCADE,
  lap_number integer NOT NULL,
  lap_time_seconds numeric NOT NULL,
  lap_time_text text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timing_laps_timing_id ON public.timing_laps(timing_id);

COMMENT ON TABLE public.timing_laps IS 'Vueltas individuales de cada sesión de cronometraje.';
COMMENT ON COLUMN public.timing_laps.timing_id IS 'FK a vehicle_timings.';
COMMENT ON COLUMN public.timing_laps.lap_number IS 'Número de vuelta (1, 2, 3...).';
COMMENT ON COLUMN public.timing_laps.lap_time_seconds IS 'Tiempo de la vuelta en segundos.';
COMMENT ON COLUMN public.timing_laps.lap_time_text IS 'Tiempo formateado (ej: 00:12.345).';

-- ========== CAMPOS DE CONSISTENCIA EN VEHICLE_TIMINGS ==========
ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS consistency_score numeric;

ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS worst_lap_timestamp numeric;

COMMENT ON COLUMN public.vehicle_timings.consistency_score IS 'Coeficiente de variación de tiempos por vuelta (std_dev/mean × 100). Menor = más consistente. Solo si hay ≥3 vueltas.';
COMMENT ON COLUMN public.vehicle_timings.worst_lap_timestamp IS 'Tiempo de la peor vuelta en segundos.';
