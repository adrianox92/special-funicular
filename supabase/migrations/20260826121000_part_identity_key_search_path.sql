-- Fija search_path de part_identity_key (advisor function_search_path_mutable).

ALTER FUNCTION public.part_identity_key(text, text, text, text, integer, numeric)
  SET search_path = pg_catalog, public;
