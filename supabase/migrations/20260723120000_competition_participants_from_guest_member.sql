-- Relacionar participantes con el miembro invitado del club que los generó (si aplica).
ALTER TABLE public.competition_participants
  ADD COLUMN IF NOT EXISTS from_guest_member_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'competition_participants_from_guest_member_id_fkey'
  ) THEN
    ALTER TABLE public.competition_participants
      ADD CONSTRAINT competition_participants_from_guest_member_id_fkey
      FOREIGN KEY (from_guest_member_id)
      REFERENCES public.club_guest_members (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_competition_participants_from_guest_member_id
  ON public.competition_participants (from_guest_member_id);

CREATE UNIQUE INDEX IF NOT EXISTS competition_participants_competition_guest_unique
  ON public.competition_participants (competition_id, from_guest_member_id)
  WHERE from_guest_member_id IS NOT NULL;

COMMENT ON COLUMN public.competition_participants.from_guest_member_id IS
  'Si el participante se añadió a partir de un miembro invitado del club (sin cuenta), referencia aquí. Permite evitar duplicados en altas masivas.';
