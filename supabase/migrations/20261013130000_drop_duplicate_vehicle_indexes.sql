-- Advisor: índices duplicados (el mismo predicado ya está cubierto por otro índice,
-- p. ej. el de la FK). Solo se eliminan si existe al menos otro índice btree sobre
-- esa columna; si idx_* fuera el único, se conserva.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_vehicles_user_id'
  ) AND (
    SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vehicles'
      AND indexdef ~* '\(.*user_id.*\)'
  ) >= 2 THEN
    DROP INDEX IF EXISTS public.idx_vehicles_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_vehicle_timings_vehicle_id'
  ) AND (
    SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vehicle_timings'
      AND indexdef ~* '\(.*vehicle_id.*\)'
  ) >= 2 THEN
    DROP INDEX IF EXISTS public.idx_vehicle_timings_vehicle_id;
  END IF;
END $$;
