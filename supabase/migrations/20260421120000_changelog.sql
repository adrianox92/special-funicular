-- Changelog in-app: entradas publicadas + lectura por usuario

CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version       text,
  title         text NOT NULL,
  body_md       text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT 'feature'
    CONSTRAINT changelog_entries_category_check
      CHECK (category IN ('feature', 'fix', 'improvement', 'breaking')),
  is_featured   boolean NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS changelog_entries_published_idx
  ON public.changelog_entries (published_at DESC)
  WHERE published_at IS NOT NULL;

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados: solo entradas ya publicadas
CREATE POLICY "changelog_entries_authenticated_read_published"
  ON public.changelog_entries FOR SELECT
  TO authenticated
  USING (published_at IS NOT NULL AND published_at <= now());

-- Escrituras solo vía service_role (API admin); no hay policies INSERT/UPDATE/DELETE para authenticated

CREATE TABLE IF NOT EXISTS public.user_changelog_reads (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_changelog_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_changelog_reads_own_all"
  ON public.user_changelog_reads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.changelog_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_changelog_reads TO authenticated;
