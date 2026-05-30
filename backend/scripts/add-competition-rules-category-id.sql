-- Añadir category_id a competition_rules (ejecutar si no se aplica la migración 20260530140000)
ALTER TABLE public.competition_rules
  ADD COLUMN IF NOT EXISTS category_id uuid
    REFERENCES public.competition_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_competition_rules_category_id
  ON public.competition_rules(category_id);
