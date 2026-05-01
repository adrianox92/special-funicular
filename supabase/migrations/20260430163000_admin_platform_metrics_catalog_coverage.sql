-- Cobertura de catálogo: totales globales sobre vehicles (no dependen del intervalo del dashboard).

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
  )
  SELECT jsonb_build_object(
    'vehicles_total', (SELECT vehicles_total FROM vc),
    'vehicles_with_catalog_item_id', (SELECT vehicles_with_catalog_item_id FROM vc),
    'users_created', (SELECT n FROM uc),
    'users_active', (SELECT n FROM ua),
    'competitions_created', (SELECT n FROM cc),
    'vehicles_in_period', (SELECT n FROM vi),
    'vehicles_by_user', (SELECT vehicles_by_user FROM vbu)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_metrics(timestamptz, timestamptz) TO service_role;
