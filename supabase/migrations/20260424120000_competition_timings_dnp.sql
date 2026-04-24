-- Añadir soporte para marcar a un participante como "No Participado (NP)" en una ronda.
-- Un NP cuenta como ronda completada (desbloquea el reparto de puntos) pero el piloto
-- recibe 0 puntos en esa ronda. Las columnas de tiempo siguen siendo NOT NULL; cuando
-- did_not_participate = true se almacenan valores centinela ('00:00.000', laps = 0) y
-- la lógica de negocio los ignora al agregar tiempos.

ALTER TABLE competition_timings
  ADD COLUMN IF NOT EXISTS did_not_participate boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN competition_timings.did_not_participate IS
  'Si es true, el participante no corrió esta ronda (NP). Recibe 0 puntos y los tiempos almacenados son valores centinela que deben ignorarse en el cálculo de clasificación.';
