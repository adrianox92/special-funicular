-- Orden de salida de pilotos en competición (gestión web + app móvil)
ALTER TABLE competition_participants
  ADD COLUMN IF NOT EXISTS start_order integer;

COMMENT ON COLUMN competition_participants.start_order IS
  'Orden de salida del piloto (1 = primero). NULL = sin orden explícito (fallback created_at).';
