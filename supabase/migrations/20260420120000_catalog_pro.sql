-- ============================================================
-- Catalog Pro — migración completa
-- 1. slug en slot_catalog_brands (SEO paths)
-- 2. UTM / afiliados en seller_profiles + store_listings
-- 3. Click tracking enriquecido
-- 4. Moderación de tiendas (rejection_reason, admin_notes, reviewed_*)
-- 5. Condición de listado (new / used / preorder)
-- 6. Tabla site_policies (textos legales editables)
-- ============================================================

-- ------------------------------------------------------------
-- 1. SLUG en slot_catalog_brands
-- ------------------------------------------------------------

-- Función SQL que replica catalogSlugify() de JS:
-- normaliza acentos vía unaccent (extensión estándar Supabase),
-- pasa a minúsculas, reemplaza no-alfanuméricos por guión y recorta.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.catalog_brand_slugify(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(
    btrim(
      regexp_replace(
        lower(unaccent(trim(coalesce(p_name, '')))),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-'
    ),
    80
  )
$$;

ALTER TABLE public.slot_catalog_brands
  ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs
UPDATE public.slot_catalog_brands
SET slug = public.catalog_brand_slugify(name)
WHERE slug IS NULL OR slug = '';

-- Resolver colisiones: si dos marcas producen el mismo slug, añadir sufijo numérico
DO $$
DECLARE
  rec RECORD;
  n   integer;
BEGIN
  FOR rec IN
    SELECT slug, array_agg(id ORDER BY created_at) AS ids
    FROM public.slot_catalog_brands
    GROUP BY slug
    HAVING COUNT(*) > 1
  LOOP
    n := 2;
    FOR i IN 2..array_length(rec.ids, 1) LOOP
      UPDATE public.slot_catalog_brands
      SET slug = public.catalog_brand_slugify(name) || '-' || n
      WHERE id = rec.ids[i];
      n := n + 1;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.slot_catalog_brands
  ALTER COLUMN slug SET NOT NULL;

DROP INDEX IF EXISTS public.slot_catalog_brands_slug_idx;
CREATE UNIQUE INDEX slot_catalog_brands_slug_idx
  ON public.slot_catalog_brands (slug);

-- Trigger para mantener slug al insertar/actualizar nombre
CREATE OR REPLACE FUNCTION public.slot_catalog_brands_set_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
  n         integer := 2;
BEGIN
  base_slug := public.catalog_brand_slugify(NEW.name);
  candidate := base_slug;

  -- Evitar colisiones (excluyendo la propia fila en UPDATE)
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.slot_catalog_brands
      WHERE slug = candidate AND id IS DISTINCT FROM NEW.id
    );
    candidate := base_slug || '-' || n;
    n := n + 1;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slot_catalog_brands_slug_tg ON public.slot_catalog_brands;
CREATE TRIGGER slot_catalog_brands_slug_tg
  BEFORE INSERT OR UPDATE OF name ON public.slot_catalog_brands
  FOR EACH ROW
  EXECUTE FUNCTION public.slot_catalog_brands_set_slug();

-- Exponer slug en la vista (necesita DROP + CREATE por ser vista sin columnas computable al vuelo)
DROP VIEW IF EXISTS public.slot_catalog_items_with_ratings CASCADE;

CREATE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.manufacturer_id,
  b.name          AS manufacturer,
  b.logo_url      AS manufacturer_logo_url,
  b.slug          AS manufacturer_slug,
  i.model_name,
  i.vehicle_type,
  i.traction,
  i.motor_position,
  i.commercial_release_year,
  i.discontinued,
  i.upcoming_release,
  i.image_url,
  i.created_at,
  i.updated_at,
  (
    SELECT COALESCE(ROUND(AVG(r.rating)::numeric, 2), NULL)
    FROM public.slot_catalog_ratings r
    WHERE r.catalog_item_id = i.id
  ) AS rating_avg,
  (
    SELECT COUNT(*)::bigint
    FROM public.slot_catalog_ratings r2
    WHERE r2.catalog_item_id = i.id
  ) AS rating_count
FROM public.slot_catalog_items i
JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id;

-- Volver a conceder permisos de lectura que CASCADE pudo haber revocado
GRANT SELECT ON public.slot_catalog_items_with_ratings TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. UTM / afiliados en seller_profiles
-- ------------------------------------------------------------

ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS default_utm_source        text NOT NULL DEFAULT 'slotdb',
  ADD COLUMN IF NOT EXISTS default_utm_medium        text NOT NULL DEFAULT 'catalog',
  ADD COLUMN IF NOT EXISTS affiliate_param_template  text;         -- ej: "aff=XYZ" sin ?

-- ------------------------------------------------------------
-- 3. custom_utm_campaign + condition en store_listings
-- ------------------------------------------------------------

ALTER TABLE public.store_listings
  ADD COLUMN IF NOT EXISTS custom_utm_campaign text,
  ADD COLUMN IF NOT EXISTS condition           text
    CONSTRAINT store_listings_condition_check
    CHECK (condition IN ('new', 'used', 'preorder') OR condition IS NULL);

-- ------------------------------------------------------------
-- 4. Click tracking enriquecido
-- ------------------------------------------------------------

ALTER TABLE public.store_listing_clicks
  ADD COLUMN IF NOT EXISTS referer    text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS ip_hash    text,   -- SHA-256 con salt, anónimo
  ADD COLUMN IF NOT EXISTS redirected boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 5. Moderación de tiendas
-- ------------------------------------------------------------

ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS admin_notes      text,
  ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- admin_notes NO se expone en las policies de lectura existentes (el select de anon/auth
-- ya está limitado a columnas concretas en el código de la API; aquí nos aseguramos con RLS).
-- La policy "seller_profiles_own_read" no selecciona admin_notes, así que queda opaco al cliente.

-- ------------------------------------------------------------
-- 6. site_policies — textos legales editables por el admin
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.site_policies (
  slug       text PRIMARY KEY,
  title      text NOT NULL DEFAULT '',
  content_md text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_policies ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer
CREATE POLICY "site_policies_public_read"
  ON public.site_policies FOR SELECT
  USING (true);

-- Solo backend con service_role puede escribir (no se crean policies de INSERT/UPDATE para roles menores)

-- Semillas iniciales (sin reemplazar si ya existen)
INSERT INTO public.site_policies (slug, title, content_md)
VALUES
  ('seller-terms',
   'Condiciones para vendedores',
   E'# Condiciones para vendedores\n\nPor definir por el equipo de moderación.'),
  ('listing-guidelines',
   'Guía de publicación de listados',
   E'# Guía de publicación de listados\n\nPor definir por el equipo de moderación.')
ON CONFLICT (slug) DO NOTHING;

-- Índice para búsquedas de clic por rango de fechas (analytics)
CREATE INDEX IF NOT EXISTS idx_store_listing_clicks_clicked_at
  ON public.store_listing_clicks (clicked_at);

-- Índice para resolución de slugs de marca
CREATE INDEX IF NOT EXISTS idx_slot_catalog_brands_slug
  ON public.slot_catalog_brands (slug);
