-- Catálogo canónico de recambios por usuario.
-- Unifica identidad entre inventory_items (stock) y components (piezas montadas).

CREATE OR REPLACE FUNCTION public.part_identity_key(
  p_category text,
  p_name text,
  p_manufacturer text,
  p_reference text,
  p_teeth integer,
  p_rpm numeric
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT
    lower(regexp_replace(btrim(coalesce(p_category, '')), '\s+', ' ', 'g')) || '|' ||
    lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')) || '|' ||
    lower(regexp_replace(btrim(coalesce(p_manufacturer, '')), '\s+', ' ', 'g')) || '|' ||
    lower(regexp_replace(btrim(coalesce(p_reference, '')), '\s+', ' ', 'g')) || '|' ||
    coalesce(p_teeth::text, '') || '|' ||
    CASE
      WHEN p_rpm IS NULL THEN ''
      WHEN p_rpm = trunc(p_rpm) THEN trunc(p_rpm)::bigint::text
      ELSE trim(both FROM regexp_replace(p_rpm::text, '(\.\d*?)0+$', '\1'))
    END;
$$;

COMMENT ON FUNCTION public.part_identity_key(text, text, text, text, integer, numeric) IS
  'Clave de identidad de recambio (categoría|nombre|marca|referencia|dientes|rpm), normalizada.';

CREATE TABLE IF NOT EXISTS public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  manufacturer text,
  reference text,
  teeth integer,
  rpm numeric,
  material text,
  size text,
  color text,
  gaus numeric,
  url text,
  description text,
  identity_key text GENERATED ALWAYS AS (
    public.part_identity_key(category, name, manufacturer, reference, teeth, rpm)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS parts_user_identity_uidx
  ON public.parts (user_id, identity_key);

CREATE INDEX IF NOT EXISTS idx_parts_user_id ON public.parts (user_id);
CREATE INDEX IF NOT EXISTS idx_parts_user_category ON public.parts (user_id, category);

COMMENT ON TABLE public.parts IS
  'Identidad canónica de recambio por usuario. Stock vive en inventory_items; montaje en components.';

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own parts" ON public.parts;
CREATE POLICY "Users select own parts"
  ON public.parts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own parts" ON public.parts;
CREATE POLICY "Users insert own parts"
  ON public.parts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own parts" ON public.parts;
CREATE POLICY "Users update own parts"
  ON public.parts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own parts" ON public.parts;
CREATE POLICY "Users delete own parts"
  ON public.parts FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL;

ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_part_id ON public.inventory_items (part_id);
CREATE INDEX IF NOT EXISTS idx_components_part_id ON public.components (part_id);

COMMENT ON COLUMN public.inventory_items.part_id IS 'Identidad de recambio canónica (public.parts).';
COMMENT ON COLUMN public.components.part_id IS 'Identidad de recambio canónica (public.parts).';

-- 1) Identidades desde inventario
INSERT INTO public.parts (
  user_id, category, name, manufacturer, reference, teeth, rpm,
  material, size, color, gaus, url, description
)
SELECT DISTINCT ON (
  i.user_id,
  public.part_identity_key(i.category, i.name, i.manufacturer, i.reference, i.teeth, i.rpm)
)
  i.user_id,
  i.category,
  i.name,
  i.manufacturer,
  i.reference,
  i.teeth,
  i.rpm,
  i.material,
  i.size,
  i.color,
  i.gaus,
  i.url,
  i.description
FROM public.inventory_items i
WHERE i.user_id IS NOT NULL
  AND btrim(coalesce(i.name, '')) <> ''
ORDER BY
  i.user_id,
  public.part_identity_key(i.category, i.name, i.manufacturer, i.reference, i.teeth, i.rpm),
  i.updated_at DESC NULLS LAST
ON CONFLICT (user_id, identity_key) DO NOTHING;

-- 2) Identidades desde componentes montados (other → otro; element → name; sku → reference)
INSERT INTO public.parts (
  user_id, category, name, manufacturer, reference, teeth, rpm,
  material, size, color, gaus, url, description
)
SELECT DISTINCT ON (
  v.user_id,
  public.part_identity_key(
    CASE WHEN c.component_type = 'other' THEN 'otro' ELSE c.component_type END,
    COALESCE(NULLIF(btrim(c.element), ''), NULLIF(btrim(c.sku), ''), 'Pieza sin nombre'),
    c.manufacturer,
    c.sku,
    c.teeth,
    c.rpm::numeric
  )
)
  v.user_id,
  CASE WHEN c.component_type = 'other' THEN 'otro' ELSE c.component_type END,
  COALESCE(NULLIF(btrim(c.element), ''), NULLIF(btrim(c.sku), ''), 'Pieza sin nombre'),
  c.manufacturer,
  NULLIF(btrim(c.sku), ''),
  c.teeth,
  c.rpm::numeric,
  c.material,
  c.size,
  c.color,
  c.gaus,
  c.url,
  c.description
FROM public.components c
JOIN public.technical_specs ts ON ts.id = c.tech_spec_id
JOIN public.vehicles v ON v.id = ts.vehicle_id
WHERE v.user_id IS NOT NULL
ON CONFLICT (user_id, identity_key) DO NOTHING;

-- 3) Enlazar filas existentes
UPDATE public.inventory_items i
SET part_id = p.id
FROM public.parts p
WHERE p.user_id = i.user_id
  AND p.identity_key = public.part_identity_key(
    i.category, i.name, i.manufacturer, i.reference, i.teeth, i.rpm
  )
  AND i.part_id IS DISTINCT FROM p.id;

UPDATE public.components c
SET part_id = p.id
FROM public.technical_specs ts
JOIN public.vehicles v ON v.id = ts.vehicle_id
JOIN public.parts p ON p.user_id = v.user_id
WHERE ts.id = c.tech_spec_id
  AND v.user_id IS NOT NULL
  AND p.identity_key = public.part_identity_key(
    CASE WHEN c.component_type = 'other' THEN 'otro' ELSE c.component_type END,
    COALESCE(NULLIF(btrim(c.element), ''), NULLIF(btrim(c.sku), ''), 'Pieza sin nombre'),
    c.manufacturer,
    c.sku,
    c.teeth,
    c.rpm::numeric
  )
  AND c.part_id IS DISTINCT FROM p.id;
