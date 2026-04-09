-- Tipo de vehículo en catálogo (misma lista que vehicles.type)
ALTER TABLE public.slot_catalog_items ADD COLUMN IF NOT EXISTS vehicle_type text;

ALTER TABLE public.slot_catalog_insert_requests ADD COLUMN IF NOT EXISTS proposed_vehicle_type text;
