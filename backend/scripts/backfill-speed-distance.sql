-- Script para rellenar campos de velocidad y distancia en registros históricos
-- Ejecutar DESPUÉS de add-speed-distance-fields.sql
--
-- Rellena vehicle_timings y competition_timings que tengan circuit_id y lane válidos.
-- Usa scale_factor del vehículo (default 32).

-- ========== BACKFILL VEHICLE_TIMINGS ==========
-- Actualizar vehicle_timings con circuit_id y lane que puedan calcularse
UPDATE public.vehicle_timings vt
SET
  track_length_meters = sub.track_length,
  total_distance_meters = sub.track_length * vt.laps,
  avg_speed_kmh = CASE
    WHEN vt.total_time_timestamp > 0 AND sub.track_length > 0
    THEN ROUND(((sub.track_length * vt.laps) / vt.total_time_timestamp) * 3.6, 2)
    ELSE NULL
  END,
  avg_speed_scale_kmh = CASE
    WHEN vt.total_time_timestamp > 0 AND sub.track_length > 0
    THEN ROUND(((sub.track_length * vt.laps) / vt.total_time_timestamp) * 3.6 * COALESCE(v.scale_factor, 32), 2)
    ELSE NULL
  END,
  best_lap_speed_kmh = CASE
    WHEN vt.best_lap_timestamp > 0 AND sub.track_length > 0
    THEN ROUND((sub.track_length / vt.best_lap_timestamp) * 3.6, 2)
    ELSE NULL
  END,
  best_lap_speed_scale_kmh = CASE
    WHEN vt.best_lap_timestamp > 0 AND sub.track_length > 0
    THEN ROUND((sub.track_length / vt.best_lap_timestamp) * 3.6 * COALESCE(v.scale_factor, 32), 2)
    ELSE NULL
  END
FROM (
  SELECT
    vt2.id,
    (c.lane_lengths->>(GREATEST(0, LEAST(
      (COALESCE(NULLIF(TRIM(vt2.lane), ''), '1')::int - 1),
      jsonb_array_length(COALESCE(c.lane_lengths, '[]'::jsonb)) - 1
    ))))::numeric AS track_length
  FROM public.vehicle_timings vt2
  JOIN public.circuits c ON c.id = vt2.circuit_id
  WHERE vt2.circuit_id IS NOT NULL
    AND vt2.lane IS NOT NULL
    AND vt2.lane ~ '^[0-9]+$'
    AND jsonb_array_length(COALESCE(c.lane_lengths, '[]'::jsonb)) > 0
) sub
JOIN public.vehicles v ON v.id = vt.vehicle_id
WHERE vt.id = sub.id
  AND sub.track_length > 0;

-- Recalcular total_distance_meters de cada vehículo
UPDATE public.vehicles v
SET total_distance_meters = COALESCE(sub.total, 0)
FROM (
  SELECT vehicle_id, SUM(total_distance_meters) AS total
  FROM public.vehicle_timings
  WHERE total_distance_meters IS NOT NULL
  GROUP BY vehicle_id
) sub
WHERE v.id = sub.vehicle_id;

-- Sumar también distancias de competition_timings (participantes con vehicle_id)
UPDATE public.vehicles v
SET total_distance_meters = v.total_distance_meters + COALESCE(sub.comp_total, 0)
FROM (
  SELECT cp.vehicle_id, SUM(ct.total_distance_meters) AS comp_total
  FROM public.competition_timings ct
  JOIN public.competition_participants cp ON cp.id = ct.participant_id
  WHERE cp.vehicle_id IS NOT NULL
    AND ct.total_distance_meters IS NOT NULL
  GROUP BY cp.vehicle_id
) sub
WHERE v.id = sub.vehicle_id;

-- ========== BACKFILL COMPETITION_TIMINGS ==========
-- Nota: lane_lengths en circuits es un array; el índice del carril es 0-based
-- lane '1' -> index 0, lane '2' -> index 1
UPDATE public.competition_timings ct
SET
  track_length_meters = sub.track_length,
  total_distance_meters = sub.track_length * ct.laps,
  avg_speed_kmh = CASE
    WHEN ct.total_time_timestamp > 0 AND sub.track_length > 0
    THEN ROUND(((sub.track_length * ct.laps) / ct.total_time_timestamp) * 3.6, 2)
    ELSE NULL
  END,
  avg_speed_scale_kmh = CASE
    WHEN ct.total_time_timestamp > 0 AND sub.track_length > 0
    THEN ROUND(((sub.track_length * ct.laps) / ct.total_time_timestamp) * 3.6 * COALESCE(sub.scale_factor, 32), 2)
    ELSE NULL
  END,
  best_lap_speed_kmh = CASE
    WHEN ct.best_lap_timestamp > 0 AND sub.track_length > 0
    THEN ROUND((sub.track_length / ct.best_lap_timestamp) * 3.6, 2)
    ELSE NULL
  END,
  best_lap_speed_scale_kmh = CASE
    WHEN ct.best_lap_timestamp > 0 AND sub.track_length > 0
    THEN ROUND((sub.track_length / ct.best_lap_timestamp) * 3.6 * COALESCE(sub.scale_factor, 32), 2)
    ELSE NULL
  END
FROM (
  SELECT
    ct2.id,
    (c.lane_lengths->>(GREATEST(0, LEAST(
      (COALESCE(NULLIF(TRIM(ct2.lane), ''), '1')::int - 1),
      jsonb_array_length(COALESCE(c.lane_lengths, '[]'::jsonb)) - 1
    ))))::numeric AS track_length,
    v.scale_factor
  FROM public.competition_timings ct2
  JOIN public.circuits c ON c.id = ct2.circuit_id
  LEFT JOIN public.competition_participants cp ON cp.id = ct2.participant_id
  LEFT JOIN public.vehicles v ON v.id = cp.vehicle_id
  WHERE ct2.circuit_id IS NOT NULL
    AND ct2.lane IS NOT NULL
    AND ct2.lane ~ '^[0-9]+$'
    AND jsonb_array_length(COALESCE(c.lane_lengths, '[]'::jsonb)) > 0
) sub
WHERE ct.id = sub.id
  AND sub.track_length > 0;
