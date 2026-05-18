-- Categorías de eventos del club (reunión, competición, etc.)

ALTER TABLE public.club_events
  ADD COLUMN IF NOT EXISTS event_category text NOT NULL DEFAULT 'other';

ALTER TABLE public.club_events
  DROP CONSTRAINT IF EXISTS club_events_event_category_check;

ALTER TABLE public.club_events
  ADD CONSTRAINT club_events_event_category_check CHECK (
    event_category IN (
      'meeting',
      'competition',
      'training',
      'social',
      'maintenance',
      'other'
    )
  );

COMMENT ON COLUMN public.club_events.event_category IS 'Tipo de evento: meeting, competition, training, social, maintenance, other.';
