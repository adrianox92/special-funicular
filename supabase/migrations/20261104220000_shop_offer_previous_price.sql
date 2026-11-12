-- Precio anterior de una oferta, para tacharlo en la ficha cuando el actual es más bajo.

alter table public.catalog_shop_offers
  add column if not exists previous_price numeric(10, 2);

comment on column public.catalog_shop_offers.previous_price is
  'Precio anterior cuando el actual es más bajo: tarifa de la tienda o última bajada entre revisiones.';
