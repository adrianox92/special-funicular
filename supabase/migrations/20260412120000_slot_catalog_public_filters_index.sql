-- Filtros públicos por tipo y año (listados GET /api/public/catalog/items)

CREATE INDEX IF NOT EXISTS idx_slot_catalog_items_vehicle_type ON public.slot_catalog_items (vehicle_type);

CREATE INDEX IF NOT EXISTS idx_slot_catalog_items_commercial_release_year ON public.slot_catalog_items (commercial_release_year);
