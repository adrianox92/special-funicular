-- Script para poblar circuit_id desde los campos de texto (circuit, circuit_name)
-- Ejecutar DESPUÉS de create-circuits-table.sql y migrate-circuit-references.sql
-- Crea circuitos en la tabla circuits y actualiza las referencias circuit_id

-- =============================================================================
-- 1. Crear circuitos desde vehicle_timings (circuit) + vehicles (user_id)
-- =============================================================================
INSERT INTO public.circuits (user_id, name, description, num_lanes, lane_lengths)
SELECT DISTINCT v.user_id, vt.circuit, NULL, 1, '[]'::jsonb
FROM public.vehicle_timings vt
INNER JOIN public.vehicles v ON v.id = vt.vehicle_id
WHERE vt.circuit IS NOT NULL AND vt.circuit <> ''
  AND vt.circuit_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.circuits c 
    WHERE c.user_id = v.user_id AND c.name = vt.circuit
  );

-- Actualizar vehicle_timings.circuit_id
UPDATE public.vehicle_timings vt
SET circuit_id = c.id
FROM public.vehicles v
INNER JOIN public.circuits c ON c.user_id = v.user_id AND c.name = vt.circuit
WHERE vt.vehicle_id = v.id
  AND vt.circuit IS NOT NULL AND vt.circuit <> ''
  AND vt.circuit_id IS NULL;

-- =============================================================================
-- 2. Crear circuitos desde competitions (circuit_name) + organizer (user_id)
-- =============================================================================
INSERT INTO public.circuits (user_id, name, description, num_lanes, lane_lengths)
SELECT DISTINCT comp.organizer, comp.circuit_name, NULL, 1, '[]'::jsonb
FROM public.competitions comp
WHERE comp.circuit_name IS NOT NULL AND comp.circuit_name <> ''
  AND comp.circuit_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.circuits c 
    WHERE c.user_id = comp.organizer AND c.name = comp.circuit_name
  );

-- Actualizar competitions.circuit_id
UPDATE public.competitions comp
SET circuit_id = c.id
FROM public.circuits c
WHERE c.user_id = comp.organizer 
  AND c.name = comp.circuit_name
  AND comp.circuit_name IS NOT NULL AND comp.circuit_name <> ''
  AND comp.circuit_id IS NULL;

-- =============================================================================
-- 3. Crear circuitos desde competition_timings (circuit) vía competition
-- =============================================================================
INSERT INTO public.circuits (user_id, name, description, num_lanes, lane_lengths)
SELECT DISTINCT comp.organizer, ct.circuit, NULL, 1, '[]'::jsonb
FROM public.competition_timings ct
INNER JOIN public.competition_participants cp ON cp.id = ct.participant_id
INNER JOIN public.competitions comp ON comp.id = cp.competition_id
WHERE ct.circuit IS NOT NULL AND ct.circuit <> ''
  AND ct.circuit_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.circuits c 
    WHERE c.user_id = comp.organizer AND c.name = ct.circuit
  );

-- Actualizar competition_timings.circuit_id
UPDATE public.competition_timings ct
SET circuit_id = c.id
FROM public.competition_participants cp
INNER JOIN public.competitions comp ON comp.id = cp.competition_id
INNER JOIN public.circuits c ON c.user_id = comp.organizer AND c.name = ct.circuit
WHERE ct.participant_id = cp.id
  AND ct.circuit IS NOT NULL AND ct.circuit <> ''
  AND ct.circuit_id IS NULL;
