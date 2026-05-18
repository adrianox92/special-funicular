-- Visibilidad pública opcional para entradas del tablón (ficha pública del club).
ALTER TABLE public.club_board_items
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_club_board_items_club_id_is_public
  ON public.club_board_items (club_id, is_public);
