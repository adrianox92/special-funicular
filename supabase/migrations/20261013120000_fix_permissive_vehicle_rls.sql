-- Cierra el agujero RLS de vehicles / technical_specs / vehicle_images / components.
-- Había políticas FOR ALL TO public USING (true) que, al OR-ear con las de propietario,
-- permitían a anon leer, insertar, modificar y borrar filas de cualquier usuario.
--
-- No se añade SELECT público: el frontend no consulta estas tablas con la anon key;
-- las páginas públicas y el partner sync (/api/sync/*) pasan por Express con
-- service_role o JWT de usuario. Dejar SELECT USING (true) seguiría filtrando
-- el garaje completo (precios, user_id, etc.) con la clave pública.
--
-- Idempotente. No aplicar a producción desde este PR: lo hace el owner.

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public vehicles access" ON public.vehicles;
DROP POLICY IF EXISTS "Public technical_specs access" ON public.technical_specs;
DROP POLICY IF EXISTS "Public vehicle_images access" ON public.vehicle_images;
DROP POLICY IF EXISTS "Public components access" ON public.components;

-- Políticas propias con nombres estables (además de las "Users … own" que ya existan).
-- Permissive OR: si ambas exigen el mismo dueño, el resultado sigue siendo owner-only.

DROP POLICY IF EXISTS vehicles_authenticated_own_select ON public.vehicles;
CREATE POLICY vehicles_authenticated_own_select
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS vehicles_authenticated_own_insert ON public.vehicles;
CREATE POLICY vehicles_authenticated_own_insert
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS vehicles_authenticated_own_update ON public.vehicles;
CREATE POLICY vehicles_authenticated_own_update
  ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS vehicles_authenticated_own_delete ON public.vehicles;
CREATE POLICY vehicles_authenticated_own_delete
  ON public.vehicles
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS technical_specs_authenticated_own_all ON public.technical_specs;
CREATE POLICY technical_specs_authenticated_own_all
  ON public.technical_specs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = technical_specs.vehicle_id
        AND v.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = technical_specs.vehicle_id
        AND v.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS vehicle_images_authenticated_own_all ON public.vehicle_images;
CREATE POLICY vehicle_images_authenticated_own_all
  ON public.vehicle_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = vehicle_images.vehicle_id
        AND v.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.id = vehicle_images.vehicle_id
        AND v.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS components_authenticated_own_all ON public.components;
CREATE POLICY components_authenticated_own_all
  ON public.components
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.technical_specs ts
      JOIN public.vehicles v ON v.id = ts.vehicle_id
      WHERE ts.id = components.tech_spec_id
        AND v.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.technical_specs ts
      JOIN public.vehicles v ON v.id = ts.vehicle_id
      WHERE ts.id = components.tech_spec_id
        AND v.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.vehicles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.technical_specs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.vehicle_images FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.components FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.technical_specs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicle_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.components TO authenticated;

GRANT ALL ON TABLE public.vehicles TO service_role;
GRANT ALL ON TABLE public.technical_specs TO service_role;
GRANT ALL ON TABLE public.vehicle_images TO service_role;
GRANT ALL ON TABLE public.components TO service_role;
