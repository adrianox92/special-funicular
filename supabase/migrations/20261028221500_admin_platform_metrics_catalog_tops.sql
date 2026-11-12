-- Tops de catálogo bajo la cobertura global.
-- Variación del periodo: vehículos con catalog_item_id creados en [p_from, p_to).
-- Histórico: los mismos enlaces, sin filtro de fechas.

CREATE OR REPLACE FUNCTION public.admin_platform_metrics(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH vc AS (
    SELECT
      COUNT(*)::int AS vehicles_total,
      COUNT(*) FILTER (WHERE v.catalog_item_id IS NOT NULL)::int AS vehicles_with_catalog_item_id
    FROM public.vehicles v
  ),
  uc AS (
    SELECT COUNT(*)::int AS n
    FROM auth.users u
    WHERE u.created_at >= p_from AND u.created_at < p_to
  ),
  ua AS (
    SELECT COUNT(*)::int AS n
    FROM auth.users u
    WHERE u.last_sign_in_at IS NOT NULL
      AND u.last_sign_in_at >= p_from
      AND u.last_sign_in_at < p_to
  ),
  cc AS (
    SELECT COUNT(*)::int AS n
    FROM public.competitions c
    WHERE c.created_at IS NOT NULL
      AND c.created_at >= p_from
      AND c.created_at < p_to
  ),
  vi AS (
    SELECT COUNT(*)::int AS n
    FROM public.vehicles v
    WHERE v.created_at >= p_from AND v.created_at < p_to
  ),
  vbu AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id', sub.user_id,
          'email', sub.email,
          'count', sub.cnt
        )
        ORDER BY sub.cnt DESC
      ),
      '[]'::jsonb
    ) AS vehicles_by_user
    FROM (
      SELECT v.user_id, au.email::text AS email, COUNT(*)::int AS cnt
      FROM public.vehicles v
      INNER JOIN auth.users au ON au.id = v.user_id
      WHERE v.created_at >= p_from AND v.created_at < p_to
      GROUP BY v.user_id, au.email
      ORDER BY COUNT(*) DESC
      LIMIT 50
    ) sub
  ),
  linked AS (
    SELECT
      v.user_id,
      v.catalog_item_id,
      i.reference,
      i.model_name,
      i.manufacturer_id,
      b.name AS brand_name,
      (v.created_at >= p_from AND v.created_at < p_to) AS in_period
    FROM public.vehicles v
    INNER JOIN public.slot_catalog_items i ON i.id = v.catalog_item_id
    INNER JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
    WHERE v.catalog_item_id IS NOT NULL
  ),
  brands_period AS (
    SELECT COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'brand_name', s.brand_name,
            'vehicle_count', s.vehicle_count,
            'user_count', s.user_count
          )
          ORDER BY s.vehicle_count DESC, s.user_count DESC, s.brand_name
        )
        FROM (
          SELECT
            l.brand_name,
            COUNT(*)::int AS vehicle_count,
            COUNT(DISTINCT l.user_id)::int AS user_count
          FROM linked l
          WHERE l.in_period
          GROUP BY l.manufacturer_id, l.brand_name
          ORDER BY COUNT(*) DESC, COUNT(DISTINCT l.user_id) DESC, l.brand_name
          LIMIT 10
        ) s
      ),
      '[]'::jsonb
    ) AS rows
  ),
  brands_all AS (
    SELECT COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'brand_name', s.brand_name,
            'vehicle_count', s.vehicle_count,
            'user_count', s.user_count
          )
          ORDER BY s.vehicle_count DESC, s.user_count DESC, s.brand_name
        )
        FROM (
          SELECT
            l.brand_name,
            COUNT(*)::int AS vehicle_count,
            COUNT(DISTINCT l.user_id)::int AS user_count
          FROM linked l
          GROUP BY l.manufacturer_id, l.brand_name
          ORDER BY COUNT(*) DESC, COUNT(DISTINCT l.user_id) DESC, l.brand_name
          LIMIT 10
        ) s
      ),
      '[]'::jsonb
    ) AS rows
  ),
  refs_period AS (
    SELECT COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'reference', s.reference,
            'model_name', s.model_name,
            'brand_name', s.brand_name,
            'user_count', s.user_count
          )
          ORDER BY s.user_count DESC, s.vehicle_count DESC, s.reference
        )
        FROM (
          SELECT
            l.reference,
            l.model_name,
            l.brand_name,
            COUNT(*)::int AS vehicle_count,
            COUNT(DISTINCT l.user_id)::int AS user_count
          FROM linked l
          WHERE l.in_period
          GROUP BY l.catalog_item_id, l.reference, l.model_name, l.brand_name
          ORDER BY COUNT(DISTINCT l.user_id) DESC, COUNT(*) DESC, l.reference
          LIMIT 10
        ) s
      ),
      '[]'::jsonb
    ) AS rows
  ),
  refs_all AS (
    SELECT COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'reference', s.reference,
            'model_name', s.model_name,
            'brand_name', s.brand_name,
            'user_count', s.user_count
          )
          ORDER BY s.user_count DESC, s.vehicle_count DESC, s.reference
        )
        FROM (
          SELECT
            l.reference,
            l.model_name,
            l.brand_name,
            COUNT(*)::int AS vehicle_count,
            COUNT(DISTINCT l.user_id)::int AS user_count
          FROM linked l
          GROUP BY l.catalog_item_id, l.reference, l.model_name, l.brand_name
          ORDER BY COUNT(DISTINCT l.user_id) DESC, COUNT(*) DESC, l.reference
          LIMIT 10
        ) s
      ),
      '[]'::jsonb
    ) AS rows
  )
  SELECT jsonb_build_object(
    'vehicles_total', (SELECT vehicles_total FROM vc),
    'vehicles_with_catalog_item_id', (SELECT vehicles_with_catalog_item_id FROM vc),
    'users_created', (SELECT n FROM uc),
    'users_active', (SELECT n FROM ua),
    'competitions_created', (SELECT n FROM cc),
    'vehicles_in_period', (SELECT n FROM vi),
    'vehicles_by_user', (SELECT vehicles_by_user FROM vbu),
    'catalog_brands_period', (SELECT rows FROM brands_period),
    'catalog_brands_all', (SELECT rows FROM brands_all),
    'catalog_refs_period', (SELECT rows FROM refs_period),
    'catalog_refs_all', (SELECT rows FROM refs_all)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) TO service_role;
