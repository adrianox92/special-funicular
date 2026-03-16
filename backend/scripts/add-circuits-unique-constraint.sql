-- Script para añadir restricción UNIQUE (user_id, name) a la tabla circuits
-- Evita duplicados de circuitos con el mismo nombre por usuario
-- Ejecutar en Supabase SQL Editor (idempotente)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'circuits_user_id_name_unique'
  ) THEN
    ALTER TABLE public.circuits
      ADD CONSTRAINT circuits_user_id_name_unique UNIQUE (user_id, name);
  END IF;
END $$;
