-- Pilotos favoritos/habituales por usuario (organizador).
-- Permite añadir participantes a una competición sin mandar invitaciones ni
-- enlaces de inscripción: el organizador mantiene una lista personal de
-- pilotos recurrentes (amigos, compañeros de club) con datos por defecto.

CREATE TABLE IF NOT EXISTS public.favorite_pilots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  linked_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  linked_slug text,
  default_vehicle_model text,
  default_vehicle_id uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS favorite_pilots_owner_idx
  ON public.favorite_pilots (owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS favorite_pilots_owner_display_name_unique
  ON public.favorite_pilots (owner_user_id, lower(display_name));

CREATE INDEX IF NOT EXISTS favorite_pilots_linked_user_idx
  ON public.favorite_pilots (linked_user_id);

COMMENT ON TABLE public.favorite_pilots IS
  'Pilotos habituales/amigos por usuario organizador. Permite alta directa en competition_participants sin invitaciones ni enlaces públicos.';
COMMENT ON COLUMN public.favorite_pilots.linked_slug IS
  'Slug (pilot_public_profiles.slug) con el que se vinculó el favorito. Se conserva aunque el perfil se desactive.';
COMMENT ON COLUMN public.favorite_pilots.default_vehicle_id IS
  'Vehículo preferido del organizador para este piloto (de su propia colección).';
COMMENT ON COLUMN public.favorite_pilots.default_vehicle_model IS
  'Texto libre de vehículo por defecto (se usa cuando no hay default_vehicle_id).';

ALTER TABLE public.favorite_pilots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorite_pilots_select_own ON public.favorite_pilots;
CREATE POLICY favorite_pilots_select_own
  ON public.favorite_pilots FOR SELECT
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS favorite_pilots_insert_own ON public.favorite_pilots;
CREATE POLICY favorite_pilots_insert_own
  ON public.favorite_pilots FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS favorite_pilots_update_own ON public.favorite_pilots;
CREATE POLICY favorite_pilots_update_own
  ON public.favorite_pilots FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS favorite_pilots_delete_own ON public.favorite_pilots;
CREATE POLICY favorite_pilots_delete_own
  ON public.favorite_pilots FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Relacionar participantes con el favorito que los generó (si aplica).
ALTER TABLE public.competition_participants
  ADD COLUMN IF NOT EXISTS from_favorite_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'competition_participants_from_favorite_id_fkey'
  ) THEN
    ALTER TABLE public.competition_participants
      ADD CONSTRAINT competition_participants_from_favorite_id_fkey
      FOREIGN KEY (from_favorite_id)
      REFERENCES public.favorite_pilots (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_competition_participants_from_favorite_id
  ON public.competition_participants (from_favorite_id);

COMMENT ON COLUMN public.competition_participants.from_favorite_id IS
  'Si el participante se añadió a partir de un favorito del organizador, referencia aquí. Permite evitar duplicados en altas masivas.';
