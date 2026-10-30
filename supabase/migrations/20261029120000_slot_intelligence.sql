-- Slot Database Intelligence (fase admin).
-- Foto agregada de popularidad y precios. Sin user_id, email ni lugar de compra
-- en las fichas. La vista pública existe para un GRANT posterior: no tiene
-- privilegios de lectura para anon ni authenticated.
--
-- Publicable: al menos 5 usuarios distintos.
-- Precios en la vista pública: solo si hay al menos 5 precios de esa serie.
-- Los lugares de compra no entran en la vista.

CREATE INDEX IF NOT EXISTS idx_vehicles_catalog_item_id
  ON public.vehicles (catalog_item_id)
  WHERE catalog_item_id IS NOT NULL;

CREATE TABLE public.slot_intelligence_summary (
  id boolean PRIMARY KEY DEFAULT true,
  computed_at timestamptz NOT NULL,
  catalog_items_total integer NOT NULL,
  catalog_items_with_owners integer NOT NULL,
  coverage_pct numeric(6, 2) NOT NULL,
  linked_vehicle_count integer NOT NULL,
  linked_user_count integer NOT NULL,
  vehicles_with_price integer NOT NULL,
  price_coverage_pct numeric(6, 2) NOT NULL,
  global_price_median numeric(12, 2),
  global_price_p25 numeric(12, 2),
  global_price_p75 numeric(12, 2),
  publishable_item_count integer NOT NULL,
  top10_refs_vehicle_share_pct numeric(6, 2) NOT NULL,
  top5_brands_vehicle_share_pct numeric(6, 2) NOT NULL,
  rarity_histogram jsonb NOT NULL,
  garage_price_basis text NOT NULL DEFAULT 'declared_as_eur',
  CONSTRAINT slot_intelligence_summary_singleton CHECK (id)
);

CREATE TABLE public.slot_intelligence_brands (
  manufacturer_id uuid PRIMARY KEY REFERENCES public.slot_catalog_brands(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  catalog_item_count integer NOT NULL,
  items_with_owners integer NOT NULL,
  coverage_pct numeric(6, 2) NOT NULL,
  vehicle_count integer NOT NULL,
  user_count integer NOT NULL,
  garage_price_n integer NOT NULL,
  garage_price_median numeric(12, 2),
  listing_count integer NOT NULL,
  listing_price_n integer NOT NULL,
  listing_price_median numeric(12, 2)
);

CREATE TABLE public.slot_intelligence_items (
  catalog_item_id uuid PRIMARY KEY REFERENCES public.slot_catalog_items(id) ON DELETE CASCADE,
  manufacturer_id uuid NOT NULL REFERENCES public.slot_catalog_brands(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  reference text NOT NULL,
  model_name text,
  vehicle_count integer NOT NULL,
  owner_count integer NOT NULL,
  penetration_pct numeric(6, 2) NOT NULL,
  garage_price_n integer NOT NULL,
  garage_price_median numeric(12, 2),
  garage_price_p25 numeric(12, 2),
  garage_price_p75 numeric(12, 2),
  listing_count integer NOT NULL,
  listing_other_currency_count integer NOT NULL,
  listing_price_n integer NOT NULL,
  listing_price_median numeric(12, 2),
  listing_new_n integer NOT NULL,
  listing_new_median numeric(12, 2),
  listing_used_n integer NOT NULL,
  listing_used_median numeric(12, 2),
  listing_preorder_n integer NOT NULL,
  listing_preorder_median numeric(12, 2),
  publishable boolean NOT NULL,
  prices_publishable boolean NOT NULL,
  CONSTRAINT slot_intelligence_items_publishable_chk
    CHECK (publishable = (owner_count >= 5)),
  CONSTRAINT slot_intelligence_items_prices_publishable_chk
    CHECK (prices_publishable = (garage_price_n >= 5))
);

CREATE INDEX idx_slot_intelligence_items_owners
  ON public.slot_intelligence_items (owner_count DESC, vehicle_count DESC, reference);

CREATE INDEX idx_slot_intelligence_items_price
  ON public.slot_intelligence_items (garage_price_median DESC NULLS LAST, owner_count DESC);

CREATE INDEX idx_slot_intelligence_items_manufacturer
  ON public.slot_intelligence_items (manufacturer_id);

CREATE TABLE public.slot_intelligence_purchase_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  manufacturer_id uuid REFERENCES public.slot_catalog_brands(id) ON DELETE CASCADE,
  brand_name text,
  place_label text NOT NULL,
  vehicle_count integer NOT NULL,
  user_count integer NOT NULL,
  CONSTRAINT slot_intelligence_purchase_places_scope_chk
    CHECK (scope IN ('global', 'brand')),
  CONSTRAINT slot_intelligence_purchase_places_scope_shape_chk
    CHECK (
      (scope = 'global' AND manufacturer_id IS NULL AND brand_name IS NULL)
      OR (scope = 'brand' AND manufacturer_id IS NOT NULL AND brand_name IS NOT NULL)
    )
);

CREATE INDEX idx_slot_intelligence_purchase_places_scope
  ON public.slot_intelligence_purchase_places (scope, manufacturer_id, vehicle_count DESC);

COMMENT ON TABLE public.slot_intelligence_purchase_places IS
  'Solo admin. Un lugar poco frecuente identifica a quien lo escribió. No entra en la vista pública.';

-- Vista lista para un GRANT futuro. security_invoker = false: el dueño de la
-- vista lee las tablas (RLS no aplica al dueño) y la vista ya filtra.
-- Abrirla después es GRANT SELECT a anon/authenticated más una ruta nueva.
CREATE VIEW public.slot_intelligence_items_public
WITH (security_invoker = false) AS
SELECT
  catalog_item_id,
  manufacturer_id,
  brand_name,
  reference,
  model_name,
  vehicle_count,
  owner_count,
  penetration_pct,
  CASE WHEN garage_price_n >= 5 THEN garage_price_n ELSE NULL END AS garage_price_n,
  CASE WHEN garage_price_n >= 5 THEN garage_price_median ELSE NULL END AS garage_price_median,
  CASE WHEN garage_price_n >= 5 THEN garage_price_p25 ELSE NULL END AS garage_price_p25,
  CASE WHEN garage_price_n >= 5 THEN garage_price_p75 ELSE NULL END AS garage_price_p75,
  listing_count,
  listing_other_currency_count,
  CASE WHEN listing_price_n >= 5 THEN listing_price_n ELSE NULL END AS listing_price_n,
  CASE WHEN listing_price_n >= 5 THEN listing_price_median ELSE NULL END AS listing_price_median,
  CASE WHEN listing_new_n >= 5 THEN listing_new_n ELSE NULL END AS listing_new_n,
  CASE WHEN listing_new_n >= 5 THEN listing_new_median ELSE NULL END AS listing_new_median,
  CASE WHEN listing_used_n >= 5 THEN listing_used_n ELSE NULL END AS listing_used_n,
  CASE WHEN listing_used_n >= 5 THEN listing_used_median ELSE NULL END AS listing_used_median,
  CASE WHEN listing_preorder_n >= 5 THEN listing_preorder_n ELSE NULL END AS listing_preorder_n,
  CASE WHEN listing_preorder_n >= 5 THEN listing_preorder_median ELSE NULL END AS listing_preorder_median,
  publishable
FROM public.slot_intelligence_items
WHERE publishable;

COMMENT ON VIEW public.slot_intelligence_items_public IS
  'Subconjunto anónimo. Ficha con >= 5 dueños. Precios solo con >= 5 observaciones. Sin lugares de compra.';

ALTER TABLE public.slot_intelligence_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_intelligence_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_intelligence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_intelligence_purchase_places ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.slot_intelligence_summary FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.slot_intelligence_brands FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.slot_intelligence_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.slot_intelligence_purchase_places FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.slot_intelligence_items_public FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.slot_intelligence_summary TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.slot_intelligence_brands TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.slot_intelligence_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.slot_intelligence_purchase_places TO service_role;
GRANT SELECT ON TABLE public.slot_intelligence_items_public TO service_role;

CREATE OR REPLACE FUNCTION public.slot_intelligence_refresh()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_computed_at timestamptz := now();
  v_catalog_total integer := 0;
  v_with_owners integer := 0;
  v_linked_vehicles integer := 0;
  v_linked_users integer := 0;
  v_with_price integer := 0;
  v_median numeric(12, 2);
  v_p25 numeric(12, 2);
  v_p75 numeric(12, 2);
  v_publishable integer := 0;
  v_top10 integer := 0;
  v_top5 integer := 0;
  v_bucket_1 integer := 0;
  v_bucket_2_4 integer := 0;
  v_bucket_5_14 integer := 0;
  v_bucket_15 integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(842610291);

  DROP TABLE IF EXISTS pg_temp.si_linked;
  DROP TABLE IF EXISTS pg_temp.si_listings;
  DROP TABLE IF EXISTS pg_temp.si_owner_by_item;
  DROP TABLE IF EXISTS pg_temp.si_price_by_item;
  DROP TABLE IF EXISTS pg_temp.si_listing_counts;
  DROP TABLE IF EXISTS pg_temp.si_listing_eur;
  DROP TABLE IF EXISTS pg_temp.si_listing_price;
  DROP TABLE IF EXISTS pg_temp.si_listing_new;
  DROP TABLE IF EXISTS pg_temp.si_listing_used;
  DROP TABLE IF EXISTS pg_temp.si_listing_preorder;
  DROP TABLE IF EXISTS pg_temp.si_items;
  DROP TABLE IF EXISTS pg_temp.si_brands;

  CREATE TEMP TABLE si_linked ON COMMIT DROP AS
  SELECT
    v.catalog_item_id,
    v.user_id,
    i.manufacturer_id,
    b.name AS brand_name,
    i.reference,
    i.model_name,
    CASE
      WHEN COALESCE(v.modified, false) = false
        AND v.price IS NOT NULL
        AND v.price > 0
      THEN v.price
      ELSE NULL
    END AS garage_price,
    public.slot_intelligence_place_key(v.purchase_place) AS place_key,
    CASE
      WHEN btrim(COALESCE(v.purchase_place, '')) = '' THEN NULL
      ELSE left(
        lower(regexp_replace(btrim(v.purchase_place), '[[:space:]]+', ' ', 'g')),
        120
      )
    END AS place_label
  FROM public.vehicles v
  INNER JOIN public.slot_catalog_items i ON i.id = v.catalog_item_id
  INNER JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
  WHERE v.catalog_item_id IS NOT NULL;

  CREATE TEMP TABLE si_listings ON COMMIT DROP AS
  SELECT
    s.catalog_item_id,
    i.manufacturer_id,
    s.price,
    s.condition,
    upper(btrim(COALESCE(s.currency, 'EUR'))) AS currency
  FROM public.store_listings s
  INNER JOIN public.slot_catalog_items i ON i.id = s.catalog_item_id
  WHERE s.active = true;

  SELECT COUNT(*)::integer, COUNT(DISTINCT user_id)::integer
  INTO v_linked_vehicles, v_linked_users
  FROM si_linked;

  SELECT COUNT(*)::integer
  INTO v_catalog_total
  FROM public.slot_catalog_items;

  SELECT COUNT(DISTINCT catalog_item_id)::integer
  INTO v_with_owners
  FROM si_linked;

  SELECT
    COUNT(*)::integer,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY garage_price))::numeric, 2),
    round((percentile_cont(0.25) WITHIN GROUP (ORDER BY garage_price))::numeric, 2),
    round((percentile_cont(0.75) WITHIN GROUP (ORDER BY garage_price))::numeric, 2)
  INTO v_with_price, v_median, v_p25, v_p75
  FROM si_linked
  WHERE garage_price IS NOT NULL;

  CREATE TEMP TABLE si_owner_by_item ON COMMIT DROP AS
  SELECT
    catalog_item_id,
    COUNT(*)::integer AS vehicle_count,
    COUNT(DISTINCT user_id)::integer AS owner_count
  FROM si_linked
  GROUP BY catalog_item_id;

  CREATE TEMP TABLE si_price_by_item ON COMMIT DROP AS
  SELECT
    catalog_item_id,
    COUNT(*)::integer AS garage_price_n,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY garage_price))::numeric, 2) AS garage_price_median,
    round((percentile_cont(0.25) WITHIN GROUP (ORDER BY garage_price))::numeric, 2) AS garage_price_p25,
    round((percentile_cont(0.75) WITHIN GROUP (ORDER BY garage_price))::numeric, 2) AS garage_price_p75
  FROM si_linked
  WHERE garage_price IS NOT NULL
  GROUP BY catalog_item_id;

  CREATE TEMP TABLE si_listing_counts ON COMMIT DROP AS
  SELECT
    catalog_item_id,
    COUNT(*)::integer AS listing_count,
    COUNT(*) FILTER (WHERE currency <> 'EUR')::integer AS listing_other_currency_count
  FROM si_listings
  GROUP BY catalog_item_id;

  CREATE TEMP TABLE si_listing_eur ON COMMIT DROP AS
  SELECT catalog_item_id, price, condition
  FROM si_listings
  WHERE currency = 'EUR'
    AND price IS NOT NULL
    AND price > 0;

  CREATE TEMP TABLE si_listing_price ON COMMIT DROP AS
  SELECT
    catalog_item_id,
    COUNT(*)::integer AS listing_price_n,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY price))::numeric, 2) AS listing_price_median
  FROM si_listing_eur
  GROUP BY catalog_item_id;

  CREATE TEMP TABLE si_listing_new ON COMMIT DROP AS
  SELECT
    catalog_item_id,
    COUNT(*)::integer AS listing_new_n,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY price))::numeric, 2) AS listing_new_median
  FROM si_listing_eur
  WHERE condition = 'new'
  GROUP BY catalog_item_id;

  CREATE TEMP TABLE si_listing_used ON COMMIT DROP AS
  SELECT
    catalog_item_id,
    COUNT(*)::integer AS listing_used_n,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY price))::numeric, 2) AS listing_used_median
  FROM si_listing_eur
  WHERE condition = 'used'
  GROUP BY catalog_item_id;

  CREATE TEMP TABLE si_listing_preorder ON COMMIT DROP AS
  SELECT
    catalog_item_id,
    COUNT(*)::integer AS listing_preorder_n,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY price))::numeric, 2) AS listing_preorder_median
  FROM si_listing_eur
  WHERE condition = 'preorder'
  GROUP BY catalog_item_id;

  CREATE TEMP TABLE si_items ON COMMIT DROP AS
  SELECT
    i.id AS catalog_item_id,
    i.manufacturer_id,
    b.name AS brand_name,
    i.reference,
    i.model_name,
    COALESCE(o.vehicle_count, 0)::integer AS vehicle_count,
    COALESCE(o.owner_count, 0)::integer AS owner_count,
    CASE
      WHEN v_linked_users = 0 THEN 0::numeric(6, 2)
      ELSE round((100.0 * COALESCE(o.owner_count, 0) / v_linked_users)::numeric, 2)
    END AS penetration_pct,
    COALESCE(p.garage_price_n, 0)::integer AS garage_price_n,
    p.garage_price_median,
    p.garage_price_p25,
    p.garage_price_p75,
    COALESCE(lc.listing_count, 0)::integer AS listing_count,
    COALESCE(lc.listing_other_currency_count, 0)::integer AS listing_other_currency_count,
    COALESCE(lp.listing_price_n, 0)::integer AS listing_price_n,
    lp.listing_price_median,
    COALESCE(ln.listing_new_n, 0)::integer AS listing_new_n,
    ln.listing_new_median,
    COALESCE(lu.listing_used_n, 0)::integer AS listing_used_n,
    lu.listing_used_median,
    COALESCE(lpr.listing_preorder_n, 0)::integer AS listing_preorder_n,
    lpr.listing_preorder_median,
    (COALESCE(o.owner_count, 0) >= 5) AS publishable,
    (COALESCE(p.garage_price_n, 0) >= 5) AS prices_publishable
  FROM public.slot_catalog_items i
  INNER JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
  LEFT JOIN si_owner_by_item o ON o.catalog_item_id = i.id
  LEFT JOIN si_price_by_item p ON p.catalog_item_id = i.id
  LEFT JOIN si_listing_counts lc ON lc.catalog_item_id = i.id
  LEFT JOIN si_listing_price lp ON lp.catalog_item_id = i.id
  LEFT JOIN si_listing_new ln ON ln.catalog_item_id = i.id
  LEFT JOIN si_listing_used lu ON lu.catalog_item_id = i.id
  LEFT JOIN si_listing_preorder lpr ON lpr.catalog_item_id = i.id
  WHERE COALESCE(o.vehicle_count, 0) > 0
     OR COALESCE(lc.listing_count, 0) > 0;

  CREATE TEMP TABLE si_brands ON COMMIT DROP AS
  SELECT
    c.manufacturer_id,
    c.brand_name,
    c.catalog_item_count,
    COALESCE(ow.items_with_owners, 0)::integer AS items_with_owners,
    CASE
      WHEN c.catalog_item_count = 0 THEN 0::numeric(6, 2)
      ELSE round((100.0 * COALESCE(ow.items_with_owners, 0) / c.catalog_item_count)::numeric, 2)
    END AS coverage_pct,
    COALESCE(bu.vehicle_count, 0)::integer AS vehicle_count,
    COALESCE(bu.user_count, 0)::integer AS user_count,
    COALESCE(bp.garage_price_n, 0)::integer AS garage_price_n,
    bp.garage_price_median,
    COALESCE(blc.listing_count, 0)::integer AS listing_count,
    COALESCE(blp.listing_price_n, 0)::integer AS listing_price_n,
    blp.listing_price_median
  FROM (
    SELECT
      i.manufacturer_id,
      b.name AS brand_name,
      COUNT(*)::integer AS catalog_item_count
    FROM public.slot_catalog_items i
    INNER JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id
    GROUP BY i.manufacturer_id, b.name
  ) c
  LEFT JOIN (
    SELECT manufacturer_id, COUNT(DISTINCT catalog_item_id)::integer AS items_with_owners
    FROM si_linked
    GROUP BY manufacturer_id
  ) ow ON ow.manufacturer_id = c.manufacturer_id
  LEFT JOIN (
    SELECT
      manufacturer_id,
      COUNT(*)::integer AS vehicle_count,
      COUNT(DISTINCT user_id)::integer AS user_count
    FROM si_linked
    GROUP BY manufacturer_id
  ) bu ON bu.manufacturer_id = c.manufacturer_id
  LEFT JOIN (
    SELECT
      manufacturer_id,
      COUNT(*)::integer AS garage_price_n,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY garage_price))::numeric, 2) AS garage_price_median
    FROM si_linked
    WHERE garage_price IS NOT NULL
    GROUP BY manufacturer_id
  ) bp ON bp.manufacturer_id = c.manufacturer_id
  LEFT JOIN (
    SELECT manufacturer_id, COUNT(*)::integer AS listing_count
    FROM si_listings
    GROUP BY manufacturer_id
  ) blc ON blc.manufacturer_id = c.manufacturer_id
  LEFT JOIN (
    SELECT
      manufacturer_id,
      COUNT(*)::integer AS listing_price_n,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY price))::numeric, 2) AS listing_price_median
    FROM si_listings
    WHERE currency = 'EUR'
      AND price IS NOT NULL
      AND price > 0
    GROUP BY manufacturer_id
  ) blp ON blp.manufacturer_id = c.manufacturer_id;

  SELECT
    COUNT(*) FILTER (WHERE publishable)::integer,
    COUNT(*) FILTER (WHERE owner_count = 1)::integer,
    COUNT(*) FILTER (WHERE owner_count BETWEEN 2 AND 4)::integer,
    COUNT(*) FILTER (WHERE owner_count BETWEEN 5 AND 14)::integer,
    COUNT(*) FILTER (WHERE owner_count >= 15)::integer
  INTO v_publishable, v_bucket_1, v_bucket_2_4, v_bucket_5_14, v_bucket_15
  FROM si_items;

  SELECT COALESCE(SUM(vehicle_count), 0)::integer
  INTO v_top10
  FROM (
    SELECT vehicle_count
    FROM si_items
    ORDER BY vehicle_count DESC, reference
    LIMIT 10
  ) top_refs;

  SELECT COALESCE(SUM(vehicle_count), 0)::integer
  INTO v_top5
  FROM (
    SELECT vehicle_count
    FROM si_brands
    ORDER BY vehicle_count DESC, brand_name
    LIMIT 5
  ) top_brands;

  -- safeupdate rechaza DELETE sin WHERE ("DELETE requires a WHERE clause").
  DELETE FROM public.slot_intelligence_items WHERE catalog_item_id IS NOT NULL;
  DELETE FROM public.slot_intelligence_brands WHERE manufacturer_id IS NOT NULL;
  DELETE FROM public.slot_intelligence_purchase_places WHERE id IS NOT NULL;
  DELETE FROM public.slot_intelligence_summary WHERE id IS NOT NULL;

  INSERT INTO public.slot_intelligence_items (
    catalog_item_id,
    manufacturer_id,
    brand_name,
    reference,
    model_name,
    vehicle_count,
    owner_count,
    penetration_pct,
    garage_price_n,
    garage_price_median,
    garage_price_p25,
    garage_price_p75,
    listing_count,
    listing_other_currency_count,
    listing_price_n,
    listing_price_median,
    listing_new_n,
    listing_new_median,
    listing_used_n,
    listing_used_median,
    listing_preorder_n,
    listing_preorder_median,
    publishable,
    prices_publishable
  )
  SELECT
    catalog_item_id,
    manufacturer_id,
    brand_name,
    reference,
    model_name,
    vehicle_count,
    owner_count,
    penetration_pct,
    garage_price_n,
    garage_price_median,
    garage_price_p25,
    garage_price_p75,
    listing_count,
    listing_other_currency_count,
    listing_price_n,
    listing_price_median,
    listing_new_n,
    listing_new_median,
    listing_used_n,
    listing_used_median,
    listing_preorder_n,
    listing_preorder_median,
    publishable,
    prices_publishable
  FROM si_items;

  INSERT INTO public.slot_intelligence_brands (
    manufacturer_id,
    brand_name,
    catalog_item_count,
    items_with_owners,
    coverage_pct,
    vehicle_count,
    user_count,
    garage_price_n,
    garage_price_median,
    listing_count,
    listing_price_n,
    listing_price_median
  )
  SELECT
    manufacturer_id,
    brand_name,
    catalog_item_count,
    items_with_owners,
    coverage_pct,
    vehicle_count,
    user_count,
    garage_price_n,
    garage_price_median,
    listing_count,
    listing_price_n,
    listing_price_median
  FROM si_brands;

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

  INSERT INTO public.slot_intelligence_summary (
    id,
    computed_at,
    catalog_items_total,
    catalog_items_with_owners,
    coverage_pct,
    linked_vehicle_count,
    linked_user_count,
    vehicles_with_price,
    price_coverage_pct,
    global_price_median,
    global_price_p25,
    global_price_p75,
    publishable_item_count,
    top10_refs_vehicle_share_pct,
    top5_brands_vehicle_share_pct,
    rarity_histogram,
    garage_price_basis
  )
  VALUES (
    true,
    v_computed_at,
    v_catalog_total,
    v_with_owners,
    CASE
      WHEN v_catalog_total = 0 THEN 0
      ELSE round((100.0 * v_with_owners / v_catalog_total)::numeric, 2)
    END,
    v_linked_vehicles,
    v_linked_users,
    v_with_price,
    CASE
      WHEN v_linked_vehicles = 0 THEN 0
      ELSE round((100.0 * v_with_price / v_linked_vehicles)::numeric, 2)
    END,
    v_median,
    v_p25,
    v_p75,
    v_publishable,
    CASE
      WHEN v_linked_vehicles = 0 THEN 0
      ELSE round((100.0 * v_top10 / v_linked_vehicles)::numeric, 2)
    END,
    CASE
      WHEN v_linked_vehicles = 0 THEN 0
      ELSE round((100.0 * v_top5 / v_linked_vehicles)::numeric, 2)
    END,
    jsonb_build_array(
      jsonb_build_object('bucket', '0', 'item_count', GREATEST(v_catalog_total - v_with_owners, 0)),
      jsonb_build_object('bucket', '1', 'item_count', v_bucket_1),
      jsonb_build_object('bucket', '2_4', 'item_count', v_bucket_2_4),
      jsonb_build_object('bucket', '5_14', 'item_count', v_bucket_5_14),
      jsonb_build_object('bucket', '15_plus', 'item_count', v_bucket_15)
    ),
    'declared_as_eur'
  );

  RETURN v_computed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.slot_intelligence_refresh() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.slot_intelligence_refresh() TO service_role;

COMMENT ON FUNCTION public.slot_intelligence_refresh() IS
  'Recalcula la foto de Slot Database Intelligence. Precios de garaje: price > 0 y modified = false, tratados como EUR. Mediana global sobre coches, no sobre medianas.';
