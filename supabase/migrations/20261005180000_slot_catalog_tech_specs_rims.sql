-- Llantas delantera/trasera (material, claves neutras) en lugar de neumáticos texto libre.
-- spec_front_wheels / spec_rear_wheels se mantienen (ruedas ≠ llantas).
-- traction y motor_position no se duplican; fase 2 (vehicles) fuera de alcance.

ALTER TABLE public.slot_catalog_items
  ADD COLUMN IF NOT EXISTS spec_front_rim text,
  ADD COLUMN IF NOT EXISTS spec_rear_rim text;

-- Mapea texto libre de neumáticos/llanta a claves; no mapeable → null.
-- Alias: i18n (es/en/de) y códigos Slot.it PL / AL / Ma.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slot_catalog_items'
      AND column_name = 'spec_front_tyres'
  ) THEN
    UPDATE public.slot_catalog_items
    SET spec_front_rim = CASE
      WHEN spec_front_tyres IS NULL OR btrim(spec_front_tyres) = '' THEN NULL
      WHEN lower(btrim(spec_front_tyres)) IN (
        'plastic', 'plastico', 'plástico', 'plastik', 'kunststoff', 'pl'
      ) THEN 'plastic'
      WHEN lower(btrim(spec_front_tyres)) IN (
        'aluminum', 'aluminium', 'aluminio', 'alu', 'al'
      ) THEN 'aluminum'
      WHEN lower(btrim(spec_front_tyres)) IN (
        'magnesium', 'magnesio', 'mag', 'ma'
      ) THEN 'magnesium'
      ELSE NULL
    END
    WHERE spec_front_rim IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slot_catalog_items'
      AND column_name = 'spec_rear_tyres'
  ) THEN
    UPDATE public.slot_catalog_items
    SET spec_rear_rim = CASE
      WHEN spec_rear_tyres IS NULL OR btrim(spec_rear_tyres) = '' THEN NULL
      WHEN lower(btrim(spec_rear_tyres)) IN (
        'plastic', 'plastico', 'plástico', 'plastik', 'kunststoff', 'pl'
      ) THEN 'plastic'
      WHEN lower(btrim(spec_rear_tyres)) IN (
        'aluminum', 'aluminium', 'aluminio', 'alu', 'al'
      ) THEN 'aluminum'
      WHEN lower(btrim(spec_rear_tyres)) IN (
        'magnesium', 'magnesio', 'mag', 'ma'
      ) THEN 'magnesium'
      ELSE NULL
    END
    WHERE spec_rear_rim IS NULL;
  END IF;
END $$;

-- Normaliza valores ya en columnas rim (re-ejecución o datos parciales).
UPDATE public.slot_catalog_items
SET spec_front_rim = CASE
  WHEN spec_front_rim IS NULL OR btrim(spec_front_rim) = '' THEN NULL
  WHEN lower(btrim(spec_front_rim)) IN (
    'plastic', 'plastico', 'plástico', 'plastik', 'kunststoff', 'pl'
  ) THEN 'plastic'
  WHEN lower(btrim(spec_front_rim)) IN (
    'aluminum', 'aluminium', 'aluminio', 'alu', 'al'
  ) THEN 'aluminum'
  WHEN lower(btrim(spec_front_rim)) IN (
    'magnesium', 'magnesio', 'mag', 'ma'
  ) THEN 'magnesium'
  ELSE NULL
END
WHERE spec_front_rim IS NOT NULL;

UPDATE public.slot_catalog_items
SET spec_rear_rim = CASE
  WHEN spec_rear_rim IS NULL OR btrim(spec_rear_rim) = '' THEN NULL
  WHEN lower(btrim(spec_rear_rim)) IN (
    'plastic', 'plastico', 'plástico', 'plastik', 'kunststoff', 'pl'
  ) THEN 'plastic'
  WHEN lower(btrim(spec_rear_rim)) IN (
    'aluminum', 'aluminium', 'aluminio', 'alu', 'al'
  ) THEN 'aluminum'
  WHEN lower(btrim(spec_rear_rim)) IN (
    'magnesium', 'magnesio', 'mag', 'ma'
  ) THEN 'magnesium'
  ELSE NULL
END
WHERE spec_rear_rim IS NOT NULL;

ALTER TABLE public.slot_catalog_items
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_front_rim_check,
  DROP CONSTRAINT IF EXISTS slot_catalog_items_spec_rear_rim_check;

ALTER TABLE public.slot_catalog_items
  ADD CONSTRAINT slot_catalog_items_spec_front_rim_check
    CHECK (spec_front_rim IS NULL OR spec_front_rim IN ('plastic', 'aluminum', 'magnesium')),
  ADD CONSTRAINT slot_catalog_items_spec_rear_rim_check
    CHECK (spec_rear_rim IS NULL OR spec_rear_rim IN ('plastic', 'aluminum', 'magnesium'));

COMMENT ON COLUMN public.slot_catalog_items.spec_front_rim IS
  'Llanta delantera: plastic | aluminum | magnesium | NULL. Etiquetas i18n en el cliente.';
COMMENT ON COLUMN public.slot_catalog_items.spec_rear_rim IS
  'Llanta trasera: plastic | aluminum | magnesium | NULL. Etiquetas i18n en el cliente.';

DROP VIEW IF EXISTS public.slot_catalog_items_with_ratings CASCADE;

CREATE VIEW public.slot_catalog_items_with_ratings AS
SELECT
  i.id,
  i.reference,
  i.manufacturer_id,
  b.name          AS manufacturer,
  b.logo_url      AS manufacturer_logo_url,
  b.slug          AS manufacturer_slug,
  i.model_name,
  i.vehicle_type,
  i.traction,
  i.motor_position,
  i.commercial_release_year,
  i.discontinued,
  i.upcoming_release,
  i.dorsal,
  i.limited_edition,
  i.limited_edition_total,
  i.real_race_results_url,
  i.real_race_photos_url,
  i.spec_scale,
  i.spec_body,
  i.spec_color,
  i.spec_system,
  i.spec_length_mm,
  i.spec_height_mm,
  i.spec_wheelbase_mm,
  i.spec_front_track_mm,
  i.spec_rear_track_mm,
  i.spec_front_axle_width_mm,
  i.spec_rear_axle_width_mm,
  i.spec_weight_g,
  i.spec_magnet,
  i.spec_motor,
  i.spec_pinion_gear,
  i.spec_front_wheels,
  i.spec_rear_wheels,
  i.spec_front_rim,
  i.spec_rear_rim,
  i.spec_front_lights,
  i.spec_rear_lights,
  i.image_url,
  i.created_at,
  i.updated_at,
  (
    SELECT COALESCE(ROUND(AVG(r.rating)::numeric, 2), NULL)
    FROM public.slot_catalog_ratings r
    WHERE r.catalog_item_id = i.id
  ) AS rating_avg,
  (
    SELECT COUNT(*)::bigint
    FROM public.slot_catalog_ratings r2
    WHERE r2.catalog_item_id = i.id
  ) AS rating_count
FROM public.slot_catalog_items i
JOIN public.slot_catalog_brands b ON b.id = i.manufacturer_id;

GRANT SELECT ON public.slot_catalog_items_with_ratings TO anon, authenticated, service_role;

ALTER TABLE public.slot_catalog_items
  DROP COLUMN IF EXISTS spec_front_tyres,
  DROP COLUMN IF EXISTS spec_rear_tyres;
