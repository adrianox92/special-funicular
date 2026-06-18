-- Conteos enlazables alineados con admin_link_vehicles_by_garage_ref_to_catalog_item
-- (solo vehículos con catalog_item_id IS NULL; opcionalmente filtro por fabricante de muestra).

CREATE OR REPLACE FUNCTION public.admin_vehicle_refs_missing_catalog(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_only_unlinked boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lim_off AS (
    SELECT
      LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)::int AS lim,
      GREATEST(COALESCE(p_offset, 0), 0)::int AS off
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
    WHERE v.reference IS NOT NULL
      AND trim(v.reference) <> ''
      AND (
        NOT COALESCE(p_only_unlinked, false)
        OR v.catalog_item_id IS NULL
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
  missing AS (
    SELECT
      b.*,
      (
        SELECT count(*)::int
        FROM veh_filtered vf2
        WHERE vf2.ref_norm = b.ref_norm
          AND vf2.catalog_item_id IS NULL
          AND (
            b.sample_manufacturer IS NULL
            OR lower(trim(COALESCE(vf2.manufacturer, ''))) = lower(trim(b.sample_manufacturer))
          )
      ) AS linkable_vehicle_count_sample_mfg,
      (
        SELECT count(DISTINCT vf2.user_id)::int
        FROM veh_filtered vf2
        WHERE vf2.ref_norm = b.ref_norm
          AND vf2.catalog_item_id IS NULL
          AND (
            b.sample_manufacturer IS NULL
            OR lower(trim(COALESCE(vf2.manufacturer, ''))) = lower(trim(b.sample_manufacturer))
          )
      ) AS linkable_distinct_user_count_sample_mfg
    FROM by_norm b
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.slot_catalog_items i
      WHERE lower(trim(i.reference)) = b.ref_norm
    )
  ),
  totals AS (
    SELECT count(*)::int AS n FROM missing
  ),
  page_sel AS (
    SELECT m.*
    FROM missing m
    ORDER BY m.linkable_vehicle_count DESC, m.ref_norm ASC
    LIMIT (SELECT lo.lim FROM lim_off lo)
    OFFSET (SELECT lo.off FROM lim_off lo)
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
          'sample_model', ps.sample_model
        )
        ORDER BY ps.linkable_vehicle_count DESC, ps.ref_norm ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM page_sel ps
  )
  SELECT jsonb_build_object(
    'total', (SELECT t.n FROM totals t),
    'limit', (SELECT lo.lim FROM lim_off lo),
    'offset', (SELECT lo.off FROM lim_off lo),
    'only_unlinked', COALESCE(p_only_unlinked, false),
    'rows', (SELECT r.rows FROM rows_agg r)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_vehicle_refs_missing_catalog(integer, integer, boolean) TO service_role;
