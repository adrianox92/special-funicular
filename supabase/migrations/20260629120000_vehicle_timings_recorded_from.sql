-- Origen del registro de cronometraje (web, app móvil, import, etc.)
ALTER TABLE public.vehicle_timings
  ADD COLUMN IF NOT EXISTS recorded_from text NOT NULL DEFAULT 'web'
    CHECK (recorded_from IN ('web', 'lap_timer', 'slot_race_manager', 'import'));

COMMENT ON COLUMN public.vehicle_timings.recorded_from IS
  'Origen del registro: web, lap_timer, slot_race_manager, import';
