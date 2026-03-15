-- Script para añadir circuit_id como FK a competitions, vehicle_timings y competition_timings
-- Ejecutar DESPUÉS de create-circuits-table.sql
-- Mantiene circuit_name/circuit por compatibilidad durante la transición

-- competitions: añadir circuit_id
ALTER TABLE public.competitions 
ADD COLUMN IF NOT EXISTS circuit_id uuid REFERENCES public.circuits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_competitions_circuit_id ON public.competitions(circuit_id);
COMMENT ON COLUMN public.competitions.circuit_id IS 'Referencia al circuito de la competición';

-- vehicle_timings: añadir circuit_id
ALTER TABLE public.vehicle_timings 
ADD COLUMN IF NOT EXISTS circuit_id uuid REFERENCES public.circuits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_timings_circuit_id ON public.vehicle_timings(circuit_id);
COMMENT ON COLUMN public.vehicle_timings.circuit_id IS 'Referencia al circuito donde se registró el tiempo';

-- competition_timings: añadir circuit_id
ALTER TABLE public.competition_timings 
ADD COLUMN IF NOT EXISTS circuit_id uuid REFERENCES public.circuits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_competition_timings_circuit_id ON public.competition_timings(circuit_id);
COMMENT ON COLUMN public.competition_timings.circuit_id IS 'Referencia al circuito donde se registró el tiempo';
