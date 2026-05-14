-- Índices para acelerar agregaciones frecuentes del dashboard de usuario.
-- Idempotente: IF NOT EXISTS evita fallar si ya existen nombres equivalentes.

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles (user_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_timings_vehicle_id ON public.vehicle_timings (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_timings_vehicle_timing_date_desc
  ON public.vehicle_timings (vehicle_id, timing_date DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_log_user_performed
  ON public.vehicle_maintenance_log (user_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON public.inventory_items (user_id);

CREATE INDEX IF NOT EXISTS idx_competition_participants_competition_id
  ON public.competition_participants (competition_id);

CREATE INDEX IF NOT EXISTS idx_competition_timings_participant_id
  ON public.competition_timings (participant_id);
