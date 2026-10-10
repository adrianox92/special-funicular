-- Referencias alternativas (aliases) + EAN por referencia.
-- El EAN de la referencia canónica vive en slot_catalog_items.ean (no se duplica
-- como fila alias): la canónica ya es la identidad del ítem (reference + manufacturer_id).
-- Cada mercado / forma de tienda va en slot_catalog_item_aliases, con su propio EAN.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS ean text;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_ean_length;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_ean_length
    CHECK (ean IS NULL OR char_length(trim(ean)) BETWEEN 1 AND 32);

COMMENT ON COLUMN public.slot_catalog_items.ean IS
  'EAN / código de barras de la referencia canónica. Los EAN de aliases van en slot_catalog_item_aliases.ean.';

CREATE OR REPLACE FUNCTION public.slot_catalog_items_normalize_ean()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ean := NULLIF(trim(NEW.ean), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slot_catalog_items_normalize_ean ON public.slot_catalog_items;
CREATE TRIGGER slot_catalog_items_normalize_ean
  BEFORE INSERT OR UPDATE OF ean ON public.slot_catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.slot_catalog_items_normalize_ean();

CREATE TABLE IF NOT EXISTS public.slot_catalog_item_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id uuid NOT NULL REFERENCES public.slot_catalog_items(id) ON DELETE CASCADE,
  manufacturer_id uuid NOT NULL REFERENCES public.slot_catalog_brands(id) ON DELETE RESTRICT,
  alias_reference text NOT NULL,
  alias_type text NOT NULL DEFAULT 'market'
    CHECK (alias_type IN ('market', 'short', 'shop_prefix', 'legacy_typo')),
  market text,
  brand_label text,
  ean text,
  source text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_catalog_item_aliases_alias_reference_len
    CHECK (char_length(trim(alias_reference)) BETWEEN 1 AND 64),
  CONSTRAINT slot_catalog_item_aliases_market_len
    CHECK (market IS NULL OR char_length(trim(market)) BETWEEN 1 AND 16),
  CONSTRAINT slot_catalog_item_aliases_brand_label_len
    CHECK (brand_label IS NULL OR char_length(trim(brand_label)) BETWEEN 1 AND 80),
  CONSTRAINT slot_catalog_item_aliases_ean_len
    CHECK (ean IS NULL OR char_length(trim(ean)) BETWEEN 1 AND 32),
  CONSTRAINT slot_catalog_item_aliases_source_len
    CHECK (source IS NULL OR char_length(trim(source)) BETWEEN 1 AND 80),
  CONSTRAINT slot_catalog_item_aliases_source_url_len
    CHECK (source_url IS NULL OR char_length(trim(source_url)) BETWEEN 1 AND 500)
);

COMMENT ON TABLE public.slot_catalog_item_aliases IS
  'Referencias alternativas de un ítem canónico (mercado, corta, prefijo de tienda, typo). Unicidad por marca.';
COMMENT ON COLUMN public.slot_catalog_item_aliases.manufacturer_id IS
  'Copia desnormalizada de slot_catalog_items.manufacturer_id para UNIQUE(alias, marca).';
COMMENT ON COLUMN public.slot_catalog_item_aliases.alias_type IS
  'market | short | shop_prefix | legacy_typo';
COMMENT ON COLUMN public.slot_catalog_item_aliases.market IS
  'Mercado de la variante (p. ej. ES, INT).';
COMMENT ON COLUMN public.slot_catalog_item_aliases.brand_label IS
  'Etiqueta comercial de esa variante (p. ej. Scalextric / SCX).';
COMMENT ON COLUMN public.slot_catalog_item_aliases.ean IS
  'EAN de esta referencia alternativa (distinto del EAN canónico si el mercado cambia el código).';

CREATE OR REPLACE FUNCTION public.slot_catalog_item_aliases_prepare()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mfg uuid;
  v_ref text;
BEGIN
  SELECT i.manufacturer_id, i.reference
    INTO v_mfg, v_ref
  FROM public.slot_catalog_items i
  WHERE i.id = NEW.catalog_item_id;

  IF v_mfg IS NULL THEN
    RAISE EXCEPTION 'catalog_item_id inválido'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.manufacturer_id := v_mfg;
  NEW.alias_reference := upper(trim(NEW.alias_reference));
  NEW.market := NULLIF(upper(trim(NEW.market)), '');
  NEW.brand_label := NULLIF(trim(NEW.brand_label), '');
  NEW.ean := NULLIF(trim(NEW.ean), '');
  NEW.source := NULLIF(trim(NEW.source), '');
  NEW.source_url := NULLIF(trim(NEW.source_url), '');

  IF NEW.alias_reference IS NULL OR NEW.alias_reference = '' THEN
    RAISE EXCEPTION 'alias_reference requerido'
      USING ERRCODE = 'check_violation';
  END IF;

  IF lower(NEW.alias_reference) = lower(trim(v_ref)) THEN
    RAISE EXCEPTION 'alias_reference no puede coincidir con la referencia canónica'
      USING ERRCODE = 'unique_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.slot_catalog_items i
    WHERE i.manufacturer_id = NEW.manufacturer_id
      AND lower(trim(i.reference)) = lower(NEW.alias_reference)
  ) THEN
    RAISE EXCEPTION 'alias_reference ya es referencia canónica de un ítem de esta marca'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slot_catalog_item_aliases_prepare ON public.slot_catalog_item_aliases;
CREATE TRIGGER slot_catalog_item_aliases_prepare
  BEFORE INSERT OR UPDATE ON public.slot_catalog_item_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.slot_catalog_item_aliases_prepare();

CREATE OR REPLACE FUNCTION public.slot_catalog_item_aliases_sync_manufacturer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.manufacturer_id IS DISTINCT FROM OLD.manufacturer_id THEN
    UPDATE public.slot_catalog_item_aliases
    SET manufacturer_id = NEW.manufacturer_id
    WHERE catalog_item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slot_catalog_item_aliases_sync_manufacturer ON public.slot_catalog_items;
CREATE TRIGGER slot_catalog_item_aliases_sync_manufacturer
  AFTER UPDATE OF manufacturer_id ON public.slot_catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.slot_catalog_item_aliases_sync_manufacturer();

CREATE UNIQUE INDEX IF NOT EXISTS slot_catalog_item_aliases_manufacturer_alias_unique
  ON public.slot_catalog_item_aliases (manufacturer_id, lower(alias_reference));

CREATE INDEX IF NOT EXISTS idx_slot_catalog_item_aliases_catalog_item_id
  ON public.slot_catalog_item_aliases (catalog_item_id);

CREATE INDEX IF NOT EXISTS idx_slot_catalog_item_aliases_manufacturer_id
  ON public.slot_catalog_item_aliases (manufacturer_id);

CREATE INDEX IF NOT EXISTS idx_slot_catalog_item_aliases_alias_reference_lower
  ON public.slot_catalog_item_aliases (lower(alias_reference));

CREATE INDEX IF NOT EXISTS idx_slot_catalog_item_aliases_ean
  ON public.slot_catalog_item_aliases (ean)
  WHERE ean IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slot_catalog_items_ean
  ON public.slot_catalog_items (ean)
  WHERE ean IS NOT NULL;

ALTER TABLE public.slot_catalog_item_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slot_catalog_item_aliases_select ON public.slot_catalog_item_aliases;
CREATE POLICY slot_catalog_item_aliases_select
  ON public.slot_catalog_item_aliases
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escritura alineada con GRANT de slot_catalog_items (authenticated).
-- service_role bypasea RLS (API admin / import).
DROP POLICY IF EXISTS slot_catalog_item_aliases_write ON public.slot_catalog_item_aliases;
CREATE POLICY slot_catalog_item_aliases_write
  ON public.slot_catalog_item_aliases
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.slot_catalog_item_aliases TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.slot_catalog_item_aliases TO authenticated, service_role;

DROP VIEW IF EXISTS public.slot_catalog_items_with_ratings CASCADE;

CREATE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.ean,
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
  i.dorsal,
  i.limited_edition,
  i.limited_edition_total,
  i.real_race_results_url,
  i.real_race_photos_url,
  i.spec_scale,
  i.spec_body,
  i.spec_color,
  i.spec_system,
  i.spec_length_mm,
  i.spec_height_mm,
  i.spec_wheelbase_mm,
  i.spec_front_track_mm,
  i.spec_rear_track_mm,
  i.spec_front_axle_width_mm,
  i.spec_rear_axle_width_mm,
  i.spec_weight_g,
  i.spec_magnet,
  i.spec_motor,
  i.spec_pinion_gear,
  i.spec_front_wheels,
  i.spec_rear_wheels,
  i.spec_front_tyres,
  i.spec_rear_tyres,
  i.spec_lights,
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

GRANT SELECT ON public.slot_catalog_items_with_ratings TO anon, authenticated, service_role;

-- Lookup: referencia canónica, alias o EAN (y prefijo de marca si aplica).
CREATE OR REPLACE FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(
  p_brand_name text,
  p_user_reference text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_brand_id uuid;
  v_prefix text;
  v_ref text;
  v_pref_trim text;
  v_id uuid;
  v_composed text;
BEGIN
  IF p_brand_name IS NULL OR trim(p_brand_name) = '' OR p_user_reference IS NULL OR trim(p_user_reference) = '' THEN
    RETURN NULL;
  END IF;

  v_ref := trim(p_user_reference);

  v_brand_id := slot_catalog_brand_id_by_name(p_brand_name);
  IF v_brand_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT b.reference_prefix INTO v_prefix
  FROM public.slot_catalog_brands b
  WHERE b.id = v_brand_id;

  SELECT i.id INTO v_id
  FROM public.slot_catalog_items i
  WHERE i.manufacturer_id = v_brand_id
    AND lower(trim(i.reference)) = lower(v_ref)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT a.catalog_item_id INTO v_id
  FROM public.slot_catalog_item_aliases a
  WHERE a.manufacturer_id = v_brand_id
    AND lower(trim(a.alias_reference)) = lower(v_ref)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT i.id INTO v_id
  FROM public.slot_catalog_items i
  WHERE i.manufacturer_id = v_brand_id
    AND i.ean IS NOT NULL
    AND lower(trim(i.ean)) = lower(v_ref)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT a.catalog_item_id INTO v_id
  FROM public.slot_catalog_item_aliases a
  WHERE a.manufacturer_id = v_brand_id
    AND a.ean IS NOT NULL
    AND lower(trim(a.ean)) = lower(v_ref)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_pref_trim := NULLIF(trim(COALESCE(v_prefix, '')), '');

  IF v_pref_trim IS NULL THEN
    RETURN NULL;
  END IF;

  IF lower(v_ref) LIKE lower(v_pref_trim) || '%' THEN
    RETURN NULL;
  END IF;

  v_composed := v_pref_trim || v_ref;

  SELECT i.id INTO v_id
  FROM public.slot_catalog_items i
  WHERE i.manufacturer_id = v_brand_id
    AND lower(trim(i.reference)) = lower(trim(v_composed))
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT a.catalog_item_id INTO v_id
  FROM public.slot_catalog_item_aliases a
  WHERE a.manufacturer_id = v_brand_id
    AND lower(trim(a.alias_reference)) = lower(trim(v_composed))
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_slot_catalog_item_by_brand_and_reference(text, text) TO service_role;

-- Informe de refs de garaje: una ref de catálogo también cuenta si es alias.
CREATE OR REPLACE FUNCTION public.admin_vehicle_refs_missing_catalog(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_only_unlinked boolean DEFAULT false,
  p_q text DEFAULT NULL,
  p_manufacturer text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)::int AS lim,
      GREATEST(COALESCE(p_offset, 0), 0)::int AS off,
      COALESCE(p_only_unlinked, false) AS only_unlinked,
      NULLIF(lower(trim(COALESCE(p_q, ''))), '') AS q_norm,
      NULLIF(lower(trim(COALESCE(p_manufacturer, ''))), '') AS mfg_norm
  ),
  params2 AS (
    SELECT
      p.*,
      CASE
        WHEN p.q_norm IS NULL THEN NULL::text
        ELSE replace(replace(replace(p.q_norm, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
      END AS q_like,
      CASE
        WHEN p.mfg_norm IS NULL THEN NULL::text
        ELSE replace(replace(replace(p.mfg_norm, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
      END AS mfg_like
    FROM params p
  ),
  veh_filtered AS (
    SELECT
      lower(trim(v.reference)) AS ref_norm,
      trim(v.reference) AS ref_trim,
      v.user_id,
      v.catalog_item_id,
      NULLIF(trim(v.manufacturer), '') AS manufacturer,
      NULLIF(trim(v.model), '') AS model
    FROM public.vehicles v
    CROSS JOIN params2 p
    WHERE v.reference IS NOT NULL
      AND trim(v.reference) <> ''
      AND (
        NOT p.only_unlinked
        OR v.catalog_item_id IS NULL
      )
      AND (
        p.q_norm IS NULL
        OR lower(trim(v.reference)) LIKE ('%' || p.q_like || '%') ESCAPE E'\\'
      )
      AND (
        p.mfg_norm IS NULL
        OR lower(trim(COALESCE(v.manufacturer, ''))) LIKE ('%' || p.mfg_like || '%') ESCAPE E'\\'
      )
  ),
  by_norm AS (
    SELECT
      vf.ref_norm,
      CASE
        WHEN p.mfg_norm IS NOT NULL THEN lower(trim(COALESCE(vf.manufacturer, '')))
        ELSE ''
      END AS mfg_group,
      min(vf.ref_trim)::text AS reference_sample,
      count(*)::int AS vehicle_count,
      count(DISTINCT vf.user_id)::int AS distinct_user_count,
      count(*) FILTER (WHERE vf.catalog_item_id IS NULL)::int AS linkable_vehicle_count,
      count(DISTINCT vf.user_id) FILTER (WHERE vf.catalog_item_id IS NULL)::int AS linkable_distinct_user_count,
      min(vf.manufacturer)::text AS sample_manufacturer,
      min(vf.model)::text AS sample_model
    FROM veh_filtered vf
    CROSS JOIN params2 p
    GROUP BY
      vf.ref_norm,
      CASE
        WHEN p.mfg_norm IS NOT NULL THEN lower(trim(COALESCE(vf.manufacturer, '')))
        ELSE ''
      END
  ),
  catalog_by_ref AS (
    SELECT
      x.ref_norm,
      count(*)::int AS catalog_item_count,
      min(x.id) AS catalog_item_id_min,
      min(x.manufacturer_id) AS catalog_manufacturer_id_min,
      min(x.reference_sample)::text AS catalog_reference_sample,
      min(x.manufacturer_name)::text AS catalog_manufacturer_name_sample
    FROM (
      SELECT
        lower(trim(i.reference)) AS ref_norm,
        i.id,
        i.manufacturer_id,
        trim(i.reference) AS reference_sample,
        b.name AS manufacturer_name
      FROM public.slot_catalog_items i
      JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
      UNION ALL
      SELECT
        lower(trim(a.alias_reference)) AS ref_norm,
        i.id,
        i.manufacturer_id,
        trim(i.reference) AS reference_sample,
        b.name AS manufacturer_name
      FROM public.slot_catalog_item_aliases a
      JOIN public.slot_catalog_items i ON i.id = a.catalog_item_id
      JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
    ) x
    GROUP BY x.ref_norm
  ),
  grouped AS (
    SELECT
      b.ref_norm,
      b.mfg_group,
      b.reference_sample,
      b.vehicle_count,
      b.distinct_user_count,
      b.linkable_vehicle_count,
      b.linkable_distinct_user_count,
      b.sample_manufacturer,
      b.sample_model,
      (COALESCE(c.catalog_item_count, 0) > 0) AS in_catalog,
      COALESCE(c.catalog_item_count, 0) AS catalog_item_count,
      CASE WHEN COALESCE(c.catalog_item_count, 0) = 1 THEN c.catalog_item_id_min ELSE NULL END AS catalog_item_id,
      CASE WHEN COALESCE(c.catalog_item_count, 0) = 1 THEN c.catalog_manufacturer_id_min ELSE NULL END AS catalog_manufacturer_id,
      CASE WHEN COALESCE(c.catalog_item_count, 0) >= 1 THEN c.catalog_reference_sample ELSE NULL END AS catalog_reference,
      CASE WHEN COALESCE(c.catalog_item_count, 0) = 1 THEN c.catalog_manufacturer_name_sample ELSE NULL END AS catalog_manufacturer
    FROM by_norm b
    LEFT JOIN catalog_by_ref c ON c.ref_norm = b.ref_norm
  ),
  with_mfg AS (
    SELECT
      g.*,
      (
        SELECT count(*)::int
        FROM veh_filtered vf2
        WHERE vf2.ref_norm = g.ref_norm
          AND vf2.catalog_item_id IS NULL
          AND (
            g.sample_manufacturer IS NULL
            OR lower(trim(COALESCE(vf2.manufacturer, ''))) = lower(trim(g.sample_manufacturer))
          )
      ) AS linkable_vehicle_count_sample_mfg,
      (
        SELECT count(DISTINCT vf2.user_id)::int
        FROM veh_filtered vf2
        WHERE vf2.ref_norm = g.ref_norm
          AND vf2.catalog_item_id IS NULL
          AND (
            g.sample_manufacturer IS NULL
            OR lower(trim(COALESCE(vf2.manufacturer, ''))) = lower(trim(g.sample_manufacturer))
          )
      ) AS linkable_distinct_user_count_sample_mfg
    FROM grouped g
  ),
  filtered AS (
    SELECT m.*
    FROM with_mfg m
    CROSS JOIN params2 p
    WHERE
      CASE
        WHEN p.q_norm IS NULL THEN NOT m.in_catalog
        ELSE m.ref_norm LIKE ('%' || p.q_like || '%') ESCAPE E'\\'
      END
  ),
  totals AS (
    SELECT count(*)::int AS n FROM filtered
  ),
  page_sel AS (
    SELECT f.*
    FROM filtered f
    CROSS JOIN params2 p
    ORDER BY
      CASE WHEN p.q_norm IS NOT NULL AND f.ref_norm = p.q_norm THEN 0 ELSE 1 END,
      f.linkable_vehicle_count DESC,
      f.ref_norm ASC,
      f.mfg_group ASC
    LIMIT (SELECT lo.lim FROM params2 lo)
    OFFSET (SELECT lo.off FROM params2 lo)
  ),
  rows_agg AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'reference', ps.reference_sample,
          'vehicle_count', ps.vehicle_count,
          'distinct_user_count', ps.distinct_user_count,
          'linkable_vehicle_count', ps.linkable_vehicle_count,
          'linkable_distinct_user_count', ps.linkable_distinct_user_count,
          'linkable_vehicle_count_sample_mfg', ps.linkable_vehicle_count_sample_mfg,
          'linkable_distinct_user_count_sample_mfg', ps.linkable_distinct_user_count_sample_mfg,
          'sample_manufacturer', ps.sample_manufacturer,
          'sample_model', ps.sample_model,
          'in_catalog', ps.in_catalog,
          'catalog_item_count', ps.catalog_item_count,
          'catalog_item_id', ps.catalog_item_id,
          'catalog_manufacturer_id', ps.catalog_manufacturer_id,
          'catalog_reference', ps.catalog_reference,
          'catalog_manufacturer', ps.catalog_manufacturer
        )
        ORDER BY
          CASE
            WHEN (SELECT q_norm FROM params2) IS NOT NULL
              AND ps.ref_norm = (SELECT q_norm FROM params2) THEN 0
            ELSE 1
          END,
          ps.linkable_vehicle_count DESC,
          ps.ref_norm ASC,
          ps.mfg_group ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM page_sel ps
  )
  SELECT jsonb_build_object(
    'total', (SELECT t.n FROM totals t),
    'limit', (SELECT lo.lim FROM params2 lo),
    'offset', (SELECT lo.off FROM params2 lo),
    'only_unlinked', (SELECT lo.only_unlinked FROM params2 lo),
    'q', (SELECT lo.q_norm FROM params2 lo),
    'manufacturer', (SELECT lo.mfg_norm FROM params2 lo),
    'rows', (SELECT r.rows FROM rows_agg r)
  );
$$;

COMMENT ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text, text) IS
  'Admin: refs de garaje. Sin p_q, solo ausentes del catálogo (canónico o alias). Con p_q, contains e incluye refs ya en catálogo. p_manufacturer filtra y agrupa por marca de garaje. Solo service_role.';

REVOKE ALL ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text, text) TO service_role;
