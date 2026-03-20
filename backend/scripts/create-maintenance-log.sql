-- Historial de mantenimiento por vehículo (limpieza, escobillas, engrase, etc.)
-- Ejecutar en Supabase SQL Editor después de desplegar el backend.

CREATE TABLE IF NOT EXISTS public.vehicle_maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  performed_at date NOT NULL,
  kind text NOT NULL,
  notes text,
  next_due_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_log_vehicle_id
  ON public.vehicle_maintenance_log(vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_log_user_id
  ON public.vehicle_maintenance_log(user_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_log_performed_at
  ON public.vehicle_maintenance_log(performed_at DESC);

ALTER TABLE public.vehicle_maintenance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own vehicle maintenance log"
  ON public.vehicle_maintenance_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own vehicle maintenance log"
  ON public.vehicle_maintenance_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own vehicle maintenance log"
  ON public.vehicle_maintenance_log FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own vehicle maintenance log"
  ON public.vehicle_maintenance_log FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.vehicle_maintenance_log IS 'Registro de mantenimiento del vehículo (no sustituye historial de modificaciones de piezas)';
