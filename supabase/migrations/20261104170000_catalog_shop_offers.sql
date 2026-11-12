-- Ofertas scrapeadas por tienda para la ficha pública.
-- El logo no se guarda en Storage: logo_url es una URL remota.
-- RLS sin políticas para anon/authenticated: solo entra el backend con service_role.

CREATE TABLE public.catalog_shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text NOT NULL,
  logo_url text,
  site_url text,
  adapter_key text NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  active boolean NOT NULL DEFAULT true,
  discover_after_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_shops_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT catalog_shops_country_code_check CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT catalog_shops_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT catalog_shops_adapter_key_len CHECK (char_length(btrim(adapter_key)) BETWEEN 1 AND 64),
  CONSTRAINT catalog_shops_logo_url_check CHECK (logo_url IS NULL OR logo_url ~ '^https?://'),
  CONSTRAINT catalog_shops_site_url_check CHECK (site_url IS NULL OR site_url ~ '^https?://')
);

COMMENT ON TABLE public.catalog_shops IS
  'Tiendas externas del catálogo. country_code es el país de origen de la tienda. logo_url no se aloja en este proyecto.';
COMMENT ON COLUMN public.catalog_shops.discover_after_id IS
  'Cursor de búsqueda por referencia: último slot_catalog_items.id ya consultado en esta tienda. NULL vuelve a empezar.';
COMMENT ON COLUMN public.catalog_shops.adapter_key IS
  'Clave del adaptador de scrape registrado en el backend. Si no existe, el cron ignora la tienda.';

CREATE TABLE public.catalog_shop_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.catalog_shops(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES public.slot_catalog_items(id) ON DELETE CASCADE,
  product_url text NOT NULL,
  price numeric(10, 2),
  currency text NOT NULL DEFAULT 'EUR',
  in_stock boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  last_attempt_at timestamptz,
  last_check_error text,
  short_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_shop_offers_shop_item_key UNIQUE (shop_id, catalog_item_id),
  CONSTRAINT catalog_shop_offers_short_code_key UNIQUE (short_code),
  CONSTRAINT catalog_shop_offers_short_code_check CHECK (short_code ~ '^[A-Za-z0-9]{7}$'),
  CONSTRAINT catalog_shop_offers_product_url_check CHECK (product_url ~ '^https?://'),
  CONSTRAINT catalog_shop_offers_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE public.catalog_shop_offers IS
  'Una fila por tienda y coche. La ficha pública solo muestra in_stock con last_checked_at de los últimos 8 días.';
COMMENT ON COLUMN public.catalog_shop_offers.short_code IS
  'Código de https://www.slotdatabase.es/go/{code}. No hace falta un dominio nuevo.';
COMMENT ON COLUMN public.catalog_shop_offers.last_checked_at IS
  'Última lectura que confirmó stock o ausencia. Un fallo de red no la mueve.';
COMMENT ON COLUMN public.catalog_shop_offers.last_attempt_at IS
  'Último intento, también si la tienda no respondió. Ordena el lote del cron.';

CREATE TABLE public.catalog_shop_offer_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.catalog_shop_offers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referer text,
  user_agent text,
  ip_hash text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalog_shop_offer_clicks IS
  'Clics del acortador /go/:code. ip_hash es SHA-256 con sal, no la IP en claro.';

CREATE INDEX idx_catalog_shop_offers_item_in_stock
  ON public.catalog_shop_offers (catalog_item_id)
  WHERE in_stock;

CREATE INDEX idx_catalog_shop_offers_last_attempt
  ON public.catalog_shop_offers (last_attempt_at);

CREATE INDEX idx_catalog_shop_offer_clicks_offer_clicked
  ON public.catalog_shop_offer_clicks (offer_id, clicked_at);

ALTER TABLE public.catalog_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_shop_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_shop_offer_clicks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.catalog_shops FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.catalog_shop_offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.catalog_shop_offer_clicks FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_shops TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_shop_offers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catalog_shop_offer_clicks TO service_role;

-- El informe de inteligencia leía store_listings (alta manual de vendedores).
-- Pasa a las ofertas en stock confirmadas en los últimos 8 días.
DO $patch$
DECLARE
  def text;
  old_sql text;
  new_sql text;
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

  IF strpos(def, 'FROM public.catalog_shop_offers') > 0
     AND strpos(def, 'FROM public.store_listings') = 0 THEN
    RETURN;
  END IF;

  -- El fichero puede llegar con CRLF; la función en Postgres está en LF.
  old_sql := replace($old$
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
$old$, E'\r\n', E'\n');

  new_sql := replace($new$
  CREATE TEMP TABLE si_listings ON COMMIT DROP AS
  SELECT
    o.catalog_item_id,
    i.manufacturer_id,
    o.price,
    NULL::text AS condition,
    upper(btrim(COALESCE(o.currency, 'EUR'))) AS currency
  FROM public.catalog_shop_offers o
  INNER JOIN public.catalog_shops sh ON sh.id = o.shop_id AND sh.active = true
  INNER JOIN public.slot_catalog_items i ON i.id = o.catalog_item_id
  WHERE o.in_stock = true
    AND o.last_checked_at >= now() - interval '8 days';
$new$, E'\r\n', E'\n');

  IF strpos(def, old_sql) = 0 THEN
    RAISE EXCEPTION 'No se ha encontrado el origen store_listings en slot_intelligence_refresh';
  END IF;

  def := replace(def, old_sql, new_sql);

  IF strpos(def, 'FROM public.catalog_shop_offers') = 0 THEN
    RAISE EXCEPTION 'No se ha podido parchear slot_intelligence_refresh';
  END IF;

  EXECUTE def;
END
$patch$;
