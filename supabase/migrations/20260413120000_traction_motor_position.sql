-- Tracción y posición del motor (en línea / angular) en catálogo y vehículos.

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS motor_position text;

ALTER TABLE public.slot_catalog_items ADD COLUMN IF NOT EXISTS traction text;
ALTER TABLE public.slot_catalog_items ADD COLUMN IF NOT EXISTS motor_position text;

ALTER TABLE public.slot_catalog_insert_requests ADD COLUMN IF NOT EXISTS proposed_traction text;
ALTER TABLE public.slot_catalog_insert_requests ADD COLUMN IF NOT EXISTS proposed_motor_position text;
