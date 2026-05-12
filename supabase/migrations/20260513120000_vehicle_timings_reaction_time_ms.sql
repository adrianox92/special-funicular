-- Tiempo de reacción (semáforo): ms desde verde / ¡YA! hasta primer cruce en línea de salida. Opcional; NULL si no aplicable o no registrado.

ALTER TABLE public.vehicle_timings
  ADD COLUMN IF NOT EXISTS reaction_time_ms integer;

COMMENT ON COLUMN public.vehicle_timings.reaction_time_ms IS
  'Milisegundos desde semáforo en verde (o ¡YA! en cuenta atrás) hasta cruce inicial. Solo sesiones manga con semáforo; opcional.';
