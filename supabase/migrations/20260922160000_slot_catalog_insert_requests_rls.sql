-- Proponer un alta usa el JWT del usuario (rol authenticated).
-- Con RLS activo y sin policy de INSERT, Postgres rechaza la fila:
--   new row violates row-level security policy for table "slot_catalog_insert_requests"
-- La API también escribe con service_role (bypass). Estas policies cubren el
-- acceso directo con el JWT: cada usuario solo ve e inserta sus propias altas
-- pendientes. La revisión (UPDATE) sigue en la API de admin con service_role.

ALTER TABLE public.slot_catalog_insert_requests ENABLE ROW LEVEL SECURITY;

-- Una policy RESTRICTIVE que no cumpla el WITH CHECK anula las permisivas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT pol.polname AS policyname
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND cls.relname = 'slot_catalog_insert_requests'
      AND pol.polpermissive = false
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.slot_catalog_insert_requests',
      r.policyname
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT ON public.slot_catalog_insert_requests TO authenticated;

DROP POLICY IF EXISTS slot_catalog_insert_requests_select_own
  ON public.slot_catalog_insert_requests;
CREATE POLICY slot_catalog_insert_requests_select_own
  ON public.slot_catalog_insert_requests
  FOR SELECT
  TO authenticated
  USING (submitted_by = auth.uid());

DROP POLICY IF EXISTS slot_catalog_insert_requests_insert_own
  ON public.slot_catalog_insert_requests;
CREATE POLICY slot_catalog_insert_requests_insert_own
  ON public.slot_catalog_insert_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND created_catalog_item_id IS NULL
  );
