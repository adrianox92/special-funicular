-- Función: extraer dorsal numérico desde nombre de modelo (garaje `vehicles.model` o catálogo `model_name`).
-- Patrones: #33, nº33, n°33, n.33, N.º 33, n26 / N26 (n + dígitos pegados, con límite de palabra).

CREATE OR REPLACE FUNCTION public.extract_dorsal_from_vehicle_model(p_model text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    btrim(
      COALESCE(
        substring(p_model FROM '#[[:space:]]*([0-9]+)'),
        substring(p_model FROM '[Nn][º°][[:space:]]*([0-9]+)'),
        substring(p_model FROM '[Nn]\.[[:space:]]*[º°]?[[:space:]]*([0-9]+)'),
        substring(p_model FROM '[[:<:]][Nn]([0-9]+)')
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.extract_dorsal_from_vehicle_model(text) IS
  'Extrae número de dorsal desde texto (#…, nº…, n.…, n26 con límite de palabra). Primer match; NULL si no hay.';
