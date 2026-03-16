-- Script para añadir campos de velocidad, distancia y odómetro
-- Ejecutar en Supabase SQL Editor
--
-- Los coches de slot están a escala (1:32, 1:43, etc.). Se calculan:
-- - Velocidad en pista (km/h): velocidad real medida en el circuito
-- - Velocidad equivalente a escala (km/h): velocidad que tendría el coche real

-- ========== VEHICLES ==========
-- Escala del coche (32 = 1:32, 43 = 1:43)
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS scale_factor integer DEFAULT 32;

-- Odómetro: distancia total acumulada en metros
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS total_distance_meters numeric DEFAULT 0;

COMMENT ON COLUMN public.vehicles.scale_factor IS 'Escala del coche: 32 = 1:32, 43 = 1:43. Usado para calcular velocidad equivalente real.';
COMMENT ON COLUMN public.vehicles.total_distance_meters IS 'Distancia total acumulada en metros (odómetro) de todas las sesiones.';

-- ========== VEHICLE_TIMINGS ==========
ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS track_length_meters numeric;

ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS total_distance_meters numeric;

ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS avg_speed_kmh numeric;

ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS avg_speed_scale_kmh numeric;

ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS best_lap_speed_kmh numeric;

ALTER TABLE public.vehicle_timings
ADD COLUMN IF NOT EXISTS best_lap_speed_scale_kmh numeric;

COMMENT ON COLUMN public.vehicle_timings.track_length_meters IS 'Longitud del carril usado en metros (desde circuits.lane_lengths).';
COMMENT ON COLUMN public.vehicle_timings.total_distance_meters IS 'Distancia total recorrida en esta sesión = track_length * laps.';
COMMENT ON COLUMN public.vehicle_timings.avg_speed_kmh IS 'Velocidad media en pista (km/h).';
COMMENT ON COLUMN public.vehicle_timings.avg_speed_scale_kmh IS 'Velocidad media equivalente a escala real (km/h).';
COMMENT ON COLUMN public.vehicle_timings.best_lap_speed_kmh IS 'Velocidad en la mejor vuelta (km/h) en pista.';
COMMENT ON COLUMN public.vehicle_timings.best_lap_speed_scale_kmh IS 'Velocidad en la mejor vuelta equivalente a escala real (km/h).';

-- ========== COMPETITION_TIMINGS ==========
ALTER TABLE public.competition_timings
ADD COLUMN IF NOT EXISTS track_length_meters numeric;

ALTER TABLE public.competition_timings
ADD COLUMN IF NOT EXISTS total_distance_meters numeric;

ALTER TABLE public.competition_timings
ADD COLUMN IF NOT EXISTS avg_speed_kmh numeric;

ALTER TABLE public.competition_timings
ADD COLUMN IF NOT EXISTS avg_speed_scale_kmh numeric;

ALTER TABLE public.competition_timings
ADD COLUMN IF NOT EXISTS best_lap_speed_kmh numeric;

ALTER TABLE public.competition_timings
ADD COLUMN IF NOT EXISTS best_lap_speed_scale_kmh numeric;

COMMENT ON COLUMN public.competition_timings.track_length_meters IS 'Longitud del carril usado en metros (desde circuits.lane_lengths).';
COMMENT ON COLUMN public.competition_timings.total_distance_meters IS 'Distancia total recorrida en esta sesión = track_length * laps.';
COMMENT ON COLUMN public.competition_timings.avg_speed_kmh IS 'Velocidad media en pista (km/h).';
COMMENT ON COLUMN public.competition_timings.avg_speed_scale_kmh IS 'Velocidad media equivalente a escala real (km/h).';
COMMENT ON COLUMN public.competition_timings.best_lap_speed_kmh IS 'Velocidad en la mejor vuelta (km/h) en pista.';
COMMENT ON COLUMN public.competition_timings.best_lap_speed_scale_kmh IS 'Velocidad en la mejor vuelta equivalente a escala real (km/h).';
