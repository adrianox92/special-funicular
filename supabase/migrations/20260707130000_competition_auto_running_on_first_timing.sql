-- Garantiza que la primera marca registrada pase la competición de published → running,
-- incluso si los tiempos se insertan por sync/API alternativa y no por createCompetitionTiming.

CREATE OR REPLACE FUNCTION public.trg_promote_competition_on_first_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_competition_id uuid;
  v_timing_count integer;
BEGIN
  SELECT cp.competition_id INTO v_competition_id
  FROM public.competition_participants cp
  WHERE cp.id = NEW.participant_id;

  IF v_competition_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_timing_count
  FROM public.competition_timings ct
  JOIN public.competition_participants cp ON cp.id = ct.participant_id
  WHERE cp.competition_id = v_competition_id;

  IF v_timing_count = 1 THEN
    UPDATE public.competitions
    SET status = 'running', updated_at = now()
    WHERE id = v_competition_id
      AND status = 'published';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_competition_timings_promote_running ON public.competition_timings;
CREATE TRIGGER trg_competition_timings_promote_running
  AFTER INSERT ON public.competition_timings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_promote_competition_on_first_timing();

-- Reparar competiciones ya afectadas (publicadas con tiempos registrados).
UPDATE public.competitions c
SET status = 'running', updated_at = now()
WHERE c.status = 'published'
  AND EXISTS (
    SELECT 1
    FROM public.competition_participants cp
    JOIN public.competition_timings ct ON ct.participant_id = cp.id
    WHERE cp.competition_id = c.id
  );
