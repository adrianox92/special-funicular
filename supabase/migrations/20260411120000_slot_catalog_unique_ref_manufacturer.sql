-- La misma referencia puede repetirse entre marcas; unicidad = (reference, manufacturer).
-- Idempotente: instalaciones nuevas ya crean esta restricción en 20260408120000_slot_catalog.sql.

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_reference_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'slot_catalog_items_reference_manufacturer_unique'
  ) THEN
    ALTER TABLE public.slot_catalog_items
      ADD CONSTRAINT slot_catalog_items_reference_manufacturer_unique UNIQUE (reference, manufacturer);
  END IF;
END $$;
