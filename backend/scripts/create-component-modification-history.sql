-- Historial de sustituciones en modificaciones (snapshot del componente anterior + fecha efectiva)
-- Ejecutar en Supabase SQL Editor después de desplegar el backend que escribe en esta tabla.

CREATE TABLE IF NOT EXISTS public.component_modification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  tech_spec_id uuid NOT NULL REFERENCES public.technical_specs(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  previous_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_component_mod_history_vehicle_id
  ON public.component_modification_history(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_component_mod_history_component_id
  ON public.component_modification_history(component_id);

CREATE INDEX IF NOT EXISTS idx_component_mod_history_user_id
  ON public.component_modification_history(user_id);

ALTER TABLE public.component_modification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own component modification history"
  ON public.component_modification_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own component modification history"
  ON public.component_modification_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own component modification history"
  ON public.component_modification_history FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.component_modification_history IS 'Registro de valores anteriores al editar un componente de modificación';
