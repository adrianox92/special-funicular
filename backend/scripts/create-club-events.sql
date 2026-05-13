-- Copia para SQL Editor (Supabase): eventos / calendario por club.

CREATE TABLE IF NOT EXISTS public.club_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_events_club_id ON public.club_events(club_id);
CREATE INDEX IF NOT EXISTS idx_club_events_event_date ON public.club_events(event_date);

COMMENT ON TABLE public.club_events IS 'Eventos del calendario de cada club (creados por owner/admins).';

-- RLS (el backend usa service role y la omite; útil para acceso directo desde cliente)
ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_events_select_member" ON public.club_events;
CREATE POLICY "club_events_select_member" ON public.club_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_events.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_events.club_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_events_insert_admin" ON public.club_events;
CREATE POLICY "club_events_insert_admin" ON public.club_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.clubs c
        WHERE c.id = club_events.club_id AND c.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.club_members m
        WHERE m.club_id = club_events.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS "club_events_update_admin" ON public.club_events;
CREATE POLICY "club_events_update_admin" ON public.club_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_events.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_events.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "club_events_delete_admin" ON public.club_events;
CREATE POLICY "club_events_delete_admin" ON public.club_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_events.club_id AND c.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_events.club_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );
