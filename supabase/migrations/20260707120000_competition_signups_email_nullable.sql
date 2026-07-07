-- Los participantes de liga pueden no tener email; la sincronización a inscripciones
-- no debe fallar por ello. Las rutas públicas/autenticadas siguen exigiendo email.
ALTER TABLE public.competition_signups
  ALTER COLUMN email DROP NOT NULL;
