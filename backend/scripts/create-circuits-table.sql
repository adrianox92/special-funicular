-- Script para crear la tabla circuits
-- Ejecutar este script en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.circuits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  description text,
  num_lanes  integer NOT NULL DEFAULT 1,
  lane_lengths jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT circuits_user_id_name_unique UNIQUE (user_id, name)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_circuits_user_id ON public.circuits(user_id);
CREATE INDEX IF NOT EXISTS idx_circuits_name ON public.circuits(name);

-- Habilitar RLS (Row Level Security) para que cada usuario solo vea sus circuitos
ALTER TABLE public.circuits ENABLE ROW LEVEL SECURITY;

-- Política: usuarios solo pueden ver sus propios circuitos
CREATE POLICY "Users can view own circuits"
  ON public.circuits FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuarios solo pueden insertar circuitos propios
CREATE POLICY "Users can insert own circuits"
  ON public.circuits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: usuarios solo pueden actualizar sus propios circuitos
CREATE POLICY "Users can update own circuits"
  ON public.circuits FOR UPDATE
  USING (auth.uid() = user_id);

-- Política: usuarios solo pueden eliminar sus propios circuitos
CREATE POLICY "Users can delete own circuits"
  ON public.circuits FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.circuits IS 'Circuitos de Scalextric con número de carriles y longitud de cada uno';
COMMENT ON COLUMN public.circuits.lane_lengths IS 'Array JSON de longitudes en metros por carril, ej: [12.5, 13.0]';
