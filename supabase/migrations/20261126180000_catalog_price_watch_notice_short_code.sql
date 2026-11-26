-- El aviso guarda el código del acortador para abrir la tienda desde la campana.

ALTER TABLE public.catalog_price_watch_notices
  ADD COLUMN IF NOT EXISTS short_code text;

ALTER TABLE public.catalog_price_watch_notices
  DROP CONSTRAINT IF EXISTS catalog_price_watch_notices_short_code_check;

ALTER TABLE public.catalog_price_watch_notices
  ADD CONSTRAINT catalog_price_watch_notices_short_code_check
  CHECK (short_code IS NULL OR short_code ~ '^[A-Za-z0-9]{7}$');

COMMENT ON COLUMN public.catalog_price_watch_notices.short_code IS
  'Código de /go/{code} de la oferta en el momento del aviso.';

UPDATE public.catalog_price_watch_notices AS notice
SET short_code = offer.short_code
FROM public.catalog_shop_offers AS offer
WHERE notice.offer_id = offer.id
  AND notice.short_code IS NULL;

CREATE OR REPLACE FUNCTION public.tg_catalog_price_watch_notices_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.watch_id := OLD.watch_id;
  NEW.offer_id := OLD.offer_id;
  NEW.shop_id := OLD.shop_id;
  NEW.catalog_item_id := OLD.catalog_item_id;
  NEW.shop_name := OLD.shop_name;
  NEW.reference := OLD.reference;
  NEW.model_name := OLD.model_name;
  NEW.price := OLD.price;
  NEW.currency := OLD.currency;
  NEW.short_code := OLD.short_code;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_catalog_price_watch_notices_guard() FROM PUBLIC, anon, authenticated;
