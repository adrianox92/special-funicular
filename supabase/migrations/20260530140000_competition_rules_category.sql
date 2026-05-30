-- Reglas de puntuación opcionales por categoría de competición
ALTER TABLE public.competition_rules
  ADD COLUMN IF NOT EXISTS category_id uuid
    REFERENCES public.competition_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_competition_rules_category_id
  ON public.competition_rules(category_id);

COMMENT ON COLUMN public.competition_rules.category_id IS
  'Categoría a la que aplica la regla; NULL = global/fallback para categorías sin regla propia';
