-- Supabase SQL Editor: calendario .ics (token), tablón del club, vínculo evento→competición.
-- Tras aplicar: crear bucket "club-documents" (público lectura o signed URLs según política)
-- y política de storage para uploads solo desde backend (service role).

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS calendar_feed_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubs_calendar_feed_token_unique
  ON public.clubs (calendar_feed_token)
  WHERE calendar_feed_token IS NOT NULL;

COMMENT ON COLUMN public.clubs.calendar_feed_token IS 'Secreto para suscripción pública .ics; no exponer en APIs genéricas.';

ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_club_events_competition_id ON public.club_events(competition_id);

CREATE TABLE IF NOT EXISTS public.club_board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link_url text,
  link_label text,
  document_url text,
  document_label text,
  document_storage_path text,
  pinned boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_board_items_club_id ON public.club_board_items(club_id);
CREATE INDEX IF NOT EXISTS idx_club_board_items_sort ON public.club_board_items(club_id, pinned DESC, sort_order, created_at);

COMMENT ON TABLE public.club_board_items IS 'Tablón del club: avisos, enlaces y documentos (URL o subida).';
COMMENT ON COLUMN public.club_board_items.document_storage_path IS 'Ruta en bucket club-documents para borrar al eliminar ítem; null si solo URL externa.';

ALTER TABLE public.club_board_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_board_items_select_member" ON public.club_board_items;
CREATE POLICY "club_board_items_select_member" ON public.club_board_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_board_items.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_board_items.club_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_board_items_insert_admin" ON public.club_board_items;
CREATE POLICY "club_board_items_insert_admin" ON public.club_board_items
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = club_board_items.club_id AND c.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.club_members m
        WHERE m.club_id = club_board_items.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "club_board_items_update_admin" ON public.club_board_items;
CREATE POLICY "club_board_items_update_admin" ON public.club_board_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_board_items.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_board_items.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "club_board_items_delete_admin" ON public.club_board_items;
CREATE POLICY "club_board_items_delete_admin" ON public.club_board_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_board_items.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_board_items.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );
