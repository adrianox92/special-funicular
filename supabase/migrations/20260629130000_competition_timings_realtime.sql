-- Habilita Supabase Realtime en competition_timings para el modo presentación en vivo.
-- El backend (presentationStream.js) se suscribe con service role y emite SSE a /presentation/stream.
-- Idempotente: no falla si la tabla ya está en la publicación (p. ej. activada manualmente en Studio).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'competition_timings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.competition_timings;
  END IF;
END $$;
