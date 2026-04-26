-- Nombre de equipo/escudería (opcional) para modo presentación y listados
ALTER TABLE public.competition_participants
  ADD COLUMN IF NOT EXISTS team_name text NULL;

COMMENT ON COLUMN public.competition_participants.team_name IS
  'Equipo o escudería del piloto (texto libre, opcional).';
