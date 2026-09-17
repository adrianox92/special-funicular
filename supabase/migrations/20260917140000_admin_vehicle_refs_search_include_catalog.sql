-- Búsqueda opcional p_q sobre referencias de garaje:
--   * vacío / null: informe ranking de refs AUSENTES del catálogo (comportamiento anterior).
--   * informado: contains sobre referencia normalizada (trim + lower); incluye grupos
--     cuya ref YA existe en slot_catalog_items, con in_catalog y catalog_item_id si es único.
-- Comodines LIKE (%, _) y backslash se escapan. El match exacto se ordena primero.

DROP FUNCTION IF EXISTS public.admin_vehicle_refs_missing_catalog(integer, integer, boolean);
DROP FUNCTION IF EXISTS public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_vehicle_refs_missing_catalog(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_only_unlinked boolean DEFAULT false,
  p_q text DEFAULT NULL
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
      NULLIF(lower(trim(COALESCE(p_q, ''))), '') AS q_norm
  ),
  params2 AS (
    SELECT
      p.*,
      CASE
        WHEN p.q_norm IS NULL THEN NULL::text
        ELSE replace(replace(replace(p.q_norm, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
      END AS q_like
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
  ),
  by_norm AS (
    SELECT
      vf.ref_norm,
      min(vf.ref_trim)::text AS reference_sample,
      count(*)::int AS vehicle_count,
      count(DISTINCT vf.user_id)::int AS distinct_user_count,
      count(*) FILTER (WHERE vf.catalog_item_id IS NULL)::int AS linkable_vehicle_count,
      count(DISTINCT vf.user_id) FILTER (WHERE vf.catalog_item_id IS NULL)::int AS linkable_distinct_user_count,
      min(vf.manufacturer)::text AS sample_manufacturer,
      min(vf.model)::text AS sample_model
    FROM veh_filtered vf
    GROUP BY vf.ref_norm
  ),
  catalog_by_ref AS (
    SELECT
      lower(trim(i.reference)) AS ref_norm,
      count(*)::int AS catalog_item_count,
      -- PG no tiene min(uuid); pick determinista. Solo se usa si count = 1.
      (array_agg(i.id ORDER BY i.id::text))[1] AS catalog_item_id_min,
      (array_agg(i.manufacturer_id ORDER BY i.id::text))[1] AS catalog_manufacturer_id_min,
      min(trim(i.reference))::text AS catalog_reference_sample,
      min(b.name)::text AS catalog_manufacturer_name_sample
    FROM public.slot_catalog_items i
    JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
    GROUP BY lower(trim(i.reference))
  ),
  grouped AS (
    SELECT
      b.ref_norm,
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
      f.ref_norm ASC
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
          ps.ref_norm ASC
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
    'rows', (SELECT r.rows FROM rows_agg r)
  );
$$;

COMMENT ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text) IS
  'Admin: refs de garaje. Sin p_q, solo ausentes del catálogo. Con p_q, contains (trim+lower) e incluye refs ya en catálogo (in_catalog, catalog_item_id si único). Solo service_role.';

REVOKE ALL ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean, text) TO service_role;
