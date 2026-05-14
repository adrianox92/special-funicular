-- Supabase SQL Editor: horas opcionales en eventos del calendario del club.
-- NULL start_time = evento de día completo (comportamiento anterior).
-- end_time NULL con start_time definida: fin = inicio + 1 h en exportaciones (Google/ICS).

ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone;

COMMENT ON COLUMN public.club_events.start_time IS 'Hora de inicio local (flotante); null = todo el día.';
COMMENT ON COLUMN public.club_events.end_time IS 'Hora de fin local; null en API = +1 h respecto a start_time en export.';
