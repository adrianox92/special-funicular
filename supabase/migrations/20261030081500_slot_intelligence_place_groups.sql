-- Agrupa variantes del mismo lugar de compra (espacios, guiones, dominio, shop, online).
-- La función de clave tiene que existir antes de recalcular la foto.

CREATE OR REPLACE FUNCTION public.slot_intelligence_place_key(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  WITH raw AS (
    SELECT NULLIF(btrim(COALESCE(p_raw, '')), '') AS src
  ),
  folded AS (
    SELECT regexp_replace(
      translate(
        lower(src),
        'áéíóúüñàèìòùâêîôûäëïöüç',
        'aeiouunaeiouaeiouaeiouc'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    ) AS s
    FROM raw
  ),
  compact AS (
    SELECT NULLIF(
      array_to_string(
        ARRAY(
          SELECT tok
          FROM unnest(
            string_to_array(regexp_replace(btrim(s), '[[:space:]]+', ' ', 'g'), ' ')
          ) AS tok
          WHERE tok <> ''
            AND tok NOT IN (
              'shop', 'online', 'store', 'web', 'www', 'net', 'com', 'es', 'persona', 'en'
            )
        ),
        ''
      ),
      ''
    ) AS key
    FROM folded
  )
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(key, '(shop|store|online|web)$', ''),
      'garage',
      'garaje',
      'g'
    ),
    ''
  )
  FROM compact;
$$;

REVOKE ALL ON FUNCTION public.slot_intelligence_place_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slot_intelligence_place_key(text) TO service_role;

COMMENT ON FUNCTION public.slot_intelligence_place_key(text) IS
  'Clave de comercio para Slot Database Intelligence. Une mayúsculas, acentos, espacios, guiones, dominios y los sufijos shop/online/store/web.';

-- La foto ya desplegada agrupa solo por el texto tal cual. Se reescribe el cuerpo
-- si todavía no usa la clave. Una instalación nueva ya trae el cuerpo actualizado.
DO $patch$
DECLARE
  def text;
  old_place text;
  new_place text;
  old_inserts text;
  new_inserts text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')
  INTO def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'slot_intelligence_refresh'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF def IS NULL THEN
    RAISE EXCEPTION 'slot_intelligence_refresh no existe';
  END IF;

  IF strpos(def, 'slot_intelligence_place_key') > 0 THEN
    RETURN;
  END IF;

  old_place := $old$
    END AS garage_price,
    CASE
      WHEN btrim(COALESCE(v.purchase_place, '')) = '' THEN NULL
      ELSE left(
        lower(regexp_replace(btrim(v.purchase_place), '[[:space:]]+', ' ', 'g')),
        120
      )
    END AS place_label
$old$;

  new_place := $new$
    END AS garage_price,
    public.slot_intelligence_place_key(v.purchase_place) AS place_key,
    CASE
      WHEN btrim(COALESCE(v.purchase_place, '')) = '' THEN NULL
      ELSE left(
        lower(regexp_replace(btrim(v.purchase_place), '[[:space:]]+', ' ', 'g')),
        120
      )
    END AS place_label
$new$;

  old_inserts := $old$
  INSERT INTO public.slot_intelligence_purchase_places (
    scope, manufacturer_id, brand_name, place_label, vehicle_count, user_count
  )
  SELECT
    'global',
    NULL,
    NULL,
    place_label,
    COUNT(*)::integer,
    COUNT(DISTINCT user_id)::integer
  FROM si_linked
  WHERE place_label IS NOT NULL
  GROUP BY place_label
  ORDER BY COUNT(*) DESC, place_label
  LIMIT 20;

  INSERT INTO public.slot_intelligence_purchase_places (
    scope, manufacturer_id, brand_name, place_label, vehicle_count, user_count
  )
  SELECT
    'brand',
    manufacturer_id,
    brand_name,
    place_label,
    vehicle_count,
    user_count
  FROM (
    SELECT
      grouped.manufacturer_id,
      grouped.brand_name,
      grouped.place_label,
      grouped.vehicle_count,
      grouped.user_count,
      ROW_NUMBER() OVER (
        PARTITION BY grouped.manufacturer_id
        ORDER BY grouped.vehicle_count DESC, grouped.place_label
      ) AS rn
    FROM (
      SELECT
        manufacturer_id,
        brand_name,
        place_label,
        COUNT(*)::integer AS vehicle_count,
        COUNT(DISTINCT user_id)::integer AS user_count
      FROM si_linked
      WHERE place_label IS NOT NULL
      GROUP BY manufacturer_id, brand_name, place_label
    ) grouped
  ) ranked
  WHERE rn <= 8;
$old$;

  new_inserts := $new$
  INSERT INTO public.slot_intelligence_purchase_places (
    scope, manufacturer_id, brand_name, place_label, vehicle_count, user_count
  )
  SELECT
    'global',
    NULL,
    NULL,
    best.place_label,
    agg.vehicle_count,
    agg.user_count
  FROM (
    SELECT
      place_key,
      COUNT(*)::integer AS vehicle_count,
      COUNT(DISTINCT user_id)::integer AS user_count
    FROM si_linked
    WHERE place_key IS NOT NULL
    GROUP BY place_key
  ) agg
  JOIN (
    SELECT DISTINCT ON (place_key) place_key, place_label
    FROM (
      SELECT place_key, place_label, COUNT(*) AS n
      FROM si_linked
      WHERE place_key IS NOT NULL AND place_label IS NOT NULL
      GROUP BY place_key, place_label
    ) label_counts
    ORDER BY place_key, n DESC, length(place_label), place_label
  ) best ON best.place_key = agg.place_key
  ORDER BY agg.vehicle_count DESC, best.place_label
  LIMIT 20;

  INSERT INTO public.slot_intelligence_purchase_places (
    scope, manufacturer_id, brand_name, place_label, vehicle_count, user_count
  )
  SELECT
    'brand',
    manufacturer_id,
    brand_name,
    place_label,
    vehicle_count,
    user_count
  FROM (
    SELECT
      ranked.manufacturer_id,
      ranked.brand_name,
      best.place_label,
      ranked.vehicle_count,
      ranked.user_count,
      ROW_NUMBER() OVER (
        PARTITION BY ranked.manufacturer_id
        ORDER BY ranked.vehicle_count DESC, best.place_label
      ) AS rn
    FROM (
      SELECT
        manufacturer_id,
        brand_name,
        place_key,
        COUNT(*)::integer AS vehicle_count,
        COUNT(DISTINCT user_id)::integer AS user_count
      FROM si_linked
      WHERE place_key IS NOT NULL
      GROUP BY manufacturer_id, brand_name, place_key
    ) ranked
    JOIN (
      SELECT DISTINCT ON (manufacturer_id, place_key)
        manufacturer_id, place_key, place_label
      FROM (
        SELECT manufacturer_id, place_key, place_label, COUNT(*) AS n
        FROM si_linked
        WHERE place_key IS NOT NULL AND place_label IS NOT NULL
        GROUP BY manufacturer_id, place_key, place_label
      ) label_counts
      ORDER BY manufacturer_id, place_key, n DESC, length(place_label), place_label
    ) best
      ON best.manufacturer_id = ranked.manufacturer_id
     AND best.place_key = ranked.place_key
  ) topn
  WHERE rn <= 8;
$new$;

  IF strpos(def, old_place) = 0 OR strpos(def, old_inserts) = 0 THEN
    RAISE EXCEPTION 'No se ha encontrado el texto de lugares de compra en slot_intelligence_refresh';
  END IF;

  def := replace(def, old_place, new_place);
  def := replace(def, old_inserts, new_inserts);
  EXECUTE def;
END
$patch$;
