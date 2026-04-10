const {
  parseLapTimeToSeconds,
  isSmartRaceHeaders,
  smartRaceRowToSyncBody,
  getSmartRaceCsvMeta,
  mergeSmartRaceRowWithImportOptions,
  hasCircuitInRow,
  hasLaneInRow,
  PREVIEW_VEHICLE_ID,
} = require('../../lib/smartraceCsvImport');

describe('parseLapTimeToSeconds', () => {
  it('parses m:ss.mmm', () => {
    expect(parseLapTimeToSeconds('0:12.632')).toBeCloseTo(12.632, 5);
    expect(parseLapTimeToSeconds('0:13.661')).toBeCloseTo(13.661, 5);
    expect(parseLapTimeToSeconds('1:05.500')).toBeCloseTo(65.5, 5);
  });

  it('parses decimal seconds', () => {
    expect(parseLapTimeToSeconds('12.5')).toBe(12.5);
  });

  it('returns null for empty', () => {
    expect(parseLapTimeToSeconds('')).toBeNull();
    expect(parseLapTimeToSeconds(null)).toBeNull();
  });
});

describe('isSmartRaceHeaders', () => {
  it('detects SmartRace-like headers', () => {
    expect(
      isSmartRaceHeaders(['posición', 'piloto', 'coche', 'vueltas', '1', '2', '3'])
    ).toBe(true);
    expect(isSmartRaceHeaders(['vueltas', '1', '2'])).toBe(true);
  });

  it('rejects native template headers', () => {
    expect(isSmartRaceHeaders(['timing_date', 'laps', 'lap_1', 'lap_2'])).toBe(false);
  });
});

describe('getSmartRaceCsvMeta', () => {
  it('detects missing circuit and lane in SmartRace export', () => {
    const headers = ['piloto', 'vueltas', '1', '2'];
    const objects = [{ piloto: 'A', vueltas: '2', '1': '0:10.000', '2': '0:11.000' }];
    const meta = getSmartRaceCsvMeta(headers, objects);
    expect(meta.needsCircuitPick).toBe(true);
    expect(meta.needsLanePick).toBe(true);
  });

  it('detects circuit and lane present in CSV', () => {
    const headers = ['circuit', 'lane', 'vueltas', '1'];
    const objects = [{ circuit: 'Home', lane: '2', vueltas: '1', '1': '0:10.000' }];
    const meta = getSmartRaceCsvMeta(headers, objects);
    expect(meta.needsCircuitPick).toBe(false);
    expect(meta.needsLanePick).toBe(false);
  });
});

describe('mergeSmartRaceRowWithImportOptions', () => {
  it('fills circuit_id and lane when missing in row', () => {
    const row = { vueltas: '1', '1': '0:10.000' };
    const merged = mergeSmartRaceRowWithImportOptions(row, {
      circuit_id: 'cid-1',
      lane: '3',
    });
    expect(hasCircuitInRow(merged)).toBe(true);
    expect(hasLaneInRow(merged)).toBe(true);
    expect(merged.circuit_id).toBe('cid-1');
    expect(merged.lane).toBe('3');
  });
});

describe('smartRaceRowToSyncBody', () => {
  it('builds sync body from a SmartRace row', () => {
    const row = {
      vueltas: '3',
      piloto: 'Test',
      '1': '0:10.000',
      '2': '0:11.000',
      '3': '0:12.000',
    };
    const body = smartRaceRowToSyncBody(row, PREVIEW_VEHICLE_ID);
    expect(body.vehicle_id).toBe(PREVIEW_VEHICLE_ID);
    expect(body.laps).toBe(3);
    expect(body.best_lap_timestamp).toBeCloseTo(10, 5);
    expect(body.total_time_timestamp).toBeCloseTo(33, 5);
    expect(body.average_time_timestamp).toBeCloseTo(11, 5);
    expect(body.lap_times).toHaveLength(3);
    expect(body.lap_times[0].lap_number).toBe(1);
    expect(body.lap_times[0].time_seconds).toBeCloseTo(10, 5);
  });
});
