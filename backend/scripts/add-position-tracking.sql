-- Script para añadir seguimiento de posiciones en vehicle_timings
-- Este script añade campos para rastrear cambios de posición

-- Añadir campo para almacenar la posición actual del vehículo en el circuito
ALTER TABLE vehicle_timings 
ADD COLUMN IF NOT EXISTS current_position integer;

-- Añadir campo para almacenar la posición anterior del vehículo en el circuito
ALTER TABLE vehicle_timings 
ADD COLUMN IF NOT EXISTS previous_position integer;

-- Añadir campo para almacenar la fecha de la última actualización de posición
ALTER TABLE vehicle_timings 
ADD COLUMN IF NOT EXISTS position_updated_at timestamp DEFAULT now();

-- Añadir campo para almacenar el cambio de posición (positivo = subió, negativo = bajó, 0 = sin cambios)
ALTER TABLE vehicle_timings 
ADD COLUMN IF NOT EXISTS position_change integer DEFAULT 0;

-- Crear índice para mejorar el rendimiento de las consultas de posición
CREATE INDEX IF NOT EXISTS idx_vehicle_timings_circuit_position 
ON vehicle_timings(circuit, best_lap_time, timing_date);

-- Crear índice para el seguimiento de cambios de posición
CREATE INDEX IF NOT EXISTS idx_vehicle_timings_position_tracking 
ON vehicle_timings(vehicle_id, circuit, position_updated_at);

-- Comentarios sobre los nuevos campos:
-- current_position: La posición actual del vehículo en el circuito
-- previous_position: La posición que tenía el vehículo en el circuito antes de este tiempo
-- position_updated_at: Cuándo se actualizó por última vez la información de posición
-- position_change: Diferencia de posición (ej: +1 significa que subió 1 puesto, -2 significa que bajó 2 puestos)
