-- Script para agregar el campo circuit_name a la tabla competitions
-- Ejecutar este script en Supabase SQL Editor

ALTER TABLE public.competitions 
ADD COLUMN circuit_name text;

-- Comentario para documentar el campo
COMMENT ON COLUMN public.competitions.circuit_name IS 'Nombre del circuito donde se realizará la competición'; 