-- Sugerencias para enlazar una referencia de garaje con una ficha de catálogo.
-- Cubre coincidencia exacta, alias, EAN, prefijo de marca y referencia que termina
-- en el código del garaje (27131 → 20027131). Como mucho 8 filas.

CREATE OR REPLACE FUNCTION public.admin_suggest_catalog_items_for_garage_ref(
  p_reference text,
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
      NULLIF(lower(trim(COALESCE(p_reference, ''))), '') AS ref_norm,
      NULLIF(lower(trim(COALESCE(p_manufacturer, ''))), '') AS mfg_norm
  ),
  params2 AS (
    SELECT
      p.ref_norm,
      p.mfg_norm,
      CASE
        WHEN p.ref_norm IS NULL THEN NULL::text
        ELSE replace(replace(replace(p.ref_norm, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
      END AS ref_like,
      CASE
        WHEN p.mfg_norm IS NULL THEN NULL::text
        ELSE replace(replace(replace(p.mfg_norm, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_')
      END AS mfg_like
    FROM params p
  ),
  united AS (
    SELECT i.id, 'exact'::text AS match_kind, 0 AS kind_rank
    FROM public.slot_catalog_items i
    CROSS JOIN params2 p
    WHERE p.ref_norm IS NOT NULL
      AND lower(trim(i.reference)) = p.ref_norm

    UNION ALL

    SELECT a.catalog_item_id, 'alias', 1
    FROM public.slot_catalog_item_aliases a
    CROSS JOIN params2 p
    WHERE p.ref_norm IS NOT NULL
      AND lower(trim(a.alias_reference)) = p.ref_norm

    UNION ALL

    SELECT i.id, 'ean', 2
    FROM public.slot_catalog_items i
    CROSS JOIN params2 p
    WHERE p.ref_norm IS NOT NULL
      AND i.ean IS NOT NULL
      AND lower(trim(i.ean)) = p.ref_norm

    UNION ALL

    SELECT a.catalog_item_id, 'ean', 2
    FROM public.slot_catalog_item_aliases a
    CROSS JOIN params2 p
    WHERE p.ref_norm IS NOT NULL
      AND a.ean IS NOT NULL
      AND lower(trim(a.ean)) = p.ref_norm

    UNION ALL

    SELECT i.id, 'prefix', 3
    FROM public.slot_catalog_items i
    JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
    CROSS JOIN params2 p
    WHERE p.ref_norm IS NOT NULL
      AND NULLIF(trim(COALESCE(b.reference_prefix, '')), '') IS NOT NULL
      AND lower(p.ref_norm) NOT LIKE lower(trim(b.reference_prefix)) || '%'
      AND lower(trim(i.reference)) = lower(trim(b.reference_prefix) || p.ref_norm)

    UNION ALL

    SELECT a.catalog_item_id, 'prefix', 3
    FROM public.slot_catalog_item_aliases a
    JOIN public.slot_catalog_brands b ON b.id = a.manufacturer_id
    CROSS JOIN params2 p
    WHERE p.ref_norm IS NOT NULL
      AND NULLIF(trim(COALESCE(b.reference_prefix, '')), '') IS NOT NULL
      AND lower(p.ref_norm) NOT LIKE lower(trim(b.reference_prefix)) || '%'
      AND lower(trim(a.alias_reference)) = lower(trim(b.reference_prefix) || p.ref_norm)

    UNION ALL

    SELECT i.id, 'suffix', 4
    FROM public.slot_catalog_items i
    CROSS JOIN params2 p
    WHERE p.ref_norm IS NOT NULL
      AND char_length(p.ref_norm) >= 4
      AND char_length(trim(i.reference)) > char_length(p.ref_norm)
      AND char_length(trim(i.reference)) - char_length(p.ref_norm) <= 12
      AND lower(trim(i.reference)) LIKE ('%' || p.ref_like) ESCAPE E'\\'
  ),
  best AS (
    SELECT DISTINCT ON (u.id) u.id, u.match_kind, u.kind_rank
    FROM united u
    ORDER BY u.id, u.kind_rank
  ),
  scored AS (
    SELECT
      i.id,
      trim(i.reference) AS reference,
      i.manufacturer_id,
      b.name AS manufacturer,
      i.model_name,
      best.match_kind,
      best.kind_rank,
      CASE
        WHEN p.mfg_norm IS NULL THEN 2
        WHEN lower(trim(b.name)) = p.mfg_norm THEN 0
        WHEN char_length(p.mfg_norm) >= 4
          AND char_length(trim(b.name)) >= 4
          AND (
            lower(trim(b.name)) LIKE ('%' || p.mfg_like || '%') ESCAPE E'\\'
            OR p.mfg_norm LIKE (
              '%' || replace(replace(replace(lower(trim(b.name)), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
            ) ESCAPE E'\\'
          ) THEN 1
        ELSE 2
      END AS manufacturer_rank
    FROM best
    JOIN public.slot_catalog_items i ON i.id = best.id
    JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
    CROSS JOIN params2 p
  ),
  ranked AS (
    SELECT s.*
    FROM scored s
    ORDER BY s.manufacturer_rank, s.kind_rank, s.reference, s.id
    LIMIT 8
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'reference', r.reference,
        'manufacturer_id', r.manufacturer_id,
        'manufacturer', r.manufacturer,
        'model_name', r.model_name,
        'match', r.match_kind,
        'manufacturer_rank', r.manufacturer_rank
      )
      ORDER BY r.manufacturer_rank, r.kind_rank, r.reference, r.id
    ),
    '[]'::jsonb
  )
  FROM ranked r;
$$;

COMMENT ON FUNCTION public.admin_suggest_catalog_items_for_garage_ref(text, text) IS
  'Admin: hasta 8 fichas cuya referencia, alias o EAN coincide con la ref de garaje, o cuya referencia termina en ella (p. ej. 27131 → 20027131). p_manufacturer prioriza la misma marca. Solo service_role.';

REVOKE ALL ON FUNCTION public.admin_suggest_catalog_items_for_garage_ref(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_suggest_catalog_items_for_garage_ref(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_suggest_catalog_items_for_garage_ref(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suggest_catalog_items_for_garage_ref(text, text) TO service_role;
