-- Lecturas públicas del catálogo en una sola ida a Postgres.
-- catalog_public_facets: conteos de filtros, sin bajar las ~10k filas de la vista.
-- catalog_public_highlights: un ítem completo por marca (antes, una consulta por marca).

CREATE OR REPLACE FUNCTION public.catalog_public_facets()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH src AS (
    SELECT
      NULLIF(btrim(manufacturer), '') AS manufacturer,
      btrim(COALESCE(manufacturer_slug, '')) AS manufacturer_slug,
      NULLIF(btrim(vehicle_type), '') AS vehicle_type,
      NULLIF(btrim(traction), '') AS traction,
      NULLIF(btrim(motor_position), '') AS motor_position,
      commercial_release_year
    FROM public.slot_catalog_items_with_ratings
  )
  SELECT jsonb_build_object(
    'manufacturers',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'slug', slug,
        'count', count
      ))
      FROM (
        SELECT
          min(manufacturer) AS name,
          COALESCE(max(NULLIF(manufacturer_slug, '')), '') AS slug,
          count(*)::int AS count
        FROM src
        WHERE manufacturer IS NOT NULL
        GROUP BY COALESCE(NULLIF(manufacturer_slug, ''), lower(manufacturer))
      ) manufacturers
    ), '[]'::jsonb),
    'vehicle_types',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', vehicle_type, 'count', count))
      FROM (
        SELECT vehicle_type, count(*)::int AS count
        FROM src
        WHERE vehicle_type IS NOT NULL
        GROUP BY vehicle_type
      ) vehicle_types
    ), '[]'::jsonb),
    'tractions',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', traction, 'count', count))
      FROM (
        SELECT traction, count(*)::int AS count
        FROM src
        WHERE traction IS NOT NULL
        GROUP BY traction
      ) tractions
    ), '[]'::jsonb),
    'motor_positions',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', motor_position, 'count', count))
      FROM (
        SELECT motor_position, count(*)::int AS count
        FROM src
        WHERE motor_position IS NOT NULL
        GROUP BY motor_position
      ) motor_positions
    ), '[]'::jsonb),
    'years',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('year', commercial_release_year, 'count', count))
      FROM (
        SELECT commercial_release_year, count(*)::int AS count
        FROM src
        WHERE commercial_release_year IS NOT NULL
        GROUP BY commercial_release_year
      ) years
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.catalog_public_facets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_public_facets() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.catalog_public_highlights()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(picked)), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (i.manufacturer_id)
      i.id,
      i.reference,
      i.manufacturer_id,
      i.manufacturer,
      i.manufacturer_logo_url,
      i.model_name,
      i.vehicle_type,
      i.traction,
      i.motor_position,
      i.commercial_release_year,
      i.image_url
    FROM public.slot_catalog_items_with_ratings i
    WHERE i.image_url IS NOT NULL AND btrim(i.image_url) <> ''
      AND i.model_name IS NOT NULL AND btrim(i.model_name) <> ''
      AND i.vehicle_type IS NOT NULL AND btrim(i.vehicle_type) <> ''
      AND i.traction IS NOT NULL AND btrim(i.traction) <> ''
      AND i.motor_position IS NOT NULL AND btrim(i.motor_position) <> ''
      AND i.commercial_release_year BETWEEN 1900 AND 2100
    ORDER BY i.manufacturer_id, i.rating_avg DESC NULLS LAST, i.reference ASC NULLS LAST, i.id ASC
  ) picked;
$$;

REVOKE ALL ON FUNCTION public.catalog_public_highlights() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_public_highlights() TO anon, authenticated, service_role;
