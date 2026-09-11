import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/axios';
import { parseLapTimeToSeconds } from '../../utils/averageLapTime';
import { emptyTiming } from './constants';
import { averageTimeTimestamp, calculateAverageTime } from './timingAverage';

export function useVehicleTimings(id, { t, error, setError, setDeleteConfirm, deleteConfirm }) {
  const { t: tTimings } = useTranslation('timings');
  const [timings, setTimings] = useState([]);
  const [editingTiming, setEditingTiming] = useState(null);
  const [newTiming, setNewTiming] = useState(emptyTiming());
  const [loadingTimings, setLoadingTimings] = useState(false);
  const [trainingGoals, setTrainingGoals] = useState([]);
  const [timingNotice, setTimingNotice] = useState(null);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [selectedTiming, setSelectedTiming] = useState(null);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceTiming, setPerformanceTiming] = useState(null);
  const [timingHasLaps, setTimingHasLaps] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);

  const calcAverage = useCallback((totalTime, laps, bestLapTime) => (
    calculateAverageTime(totalTime, laps, bestLapTime, { t, setTimingNotice })
  ), [t]);

  const loadTimings = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingTimings(true);
      const response = await api.get(`/vehicles/${id}/timings`);
      const timingsWithRecalculatedAverages = response.data.map((timing) => {
        const averageTime = calcAverage(timing.total_time, timing.laps, timing.best_lap_time);
        let average_time_timestamp = null;
        if (averageTime) {
          average_time_timestamp = averageTimeTimestamp(averageTime);
        }
        return {
          ...timing,
          average_time: averageTime || timing.average_time,
          average_time_timestamp: average_time_timestamp || timing.average_time_timestamp,
        };
      });
      setTimings(timingsWithRecalculatedAverages);
      try {
        const goalsRes = await api.get(`/vehicles/${id}/training-goals`);
        setTrainingGoals(goalsRes.data?.goals || []);
      } catch {
        setTrainingGoals([]);
      }
    } catch (err) {
      console.error('Error al cargar tiempos:', err);
      setError('Error al cargar los tiempos');
    } finally {
      setLoadingTimings(false);
    }
  }, [id, calcAverage, setError]);

  useEffect(() => {
    if (id) loadTimings();
  }, [id, loadTimings]);

  // Derive has_laps from API response (GET /vehicles/:id/timings returns has_laps)
  useEffect(() => {
    const map = {};
    timings.forEach((row) => {
      if (row.id != null) map[row.id] = !!row.has_laps;
    });
    setTimingHasLaps(map);
  }, [timings]);

  const handleTimingChange = (e) => {
    const { name, value } = e.target;
    const targetTiming = editingTiming || newTiming;
    const updateFn = editingTiming ? setEditingTiming : setNewTiming;

    let timestamp = null;
    if (['best_lap_time', 'total_time', 'average_time'].includes(name)) {
      timestamp = parseLapTimeToSeconds(value);
    }

    const updatedTiming = {
      ...targetTiming,
      [name]: value,
    };
    if (['best_lap_time', 'total_time', 'average_time'].includes(name)) {
      updatedTiming[`${name}_timestamp`] = timestamp;
    }

    if (name === 'total_time' || name === 'laps' || name === 'best_lap_time') {
      const totalTime = name === 'total_time' ? value : targetTiming.total_time;
      const laps = name === 'laps' ? value : targetTiming.laps;
      const bestLapTime = name === 'best_lap_time' ? value : targetTiming.best_lap_time;

      const averageTime = calcAverage(totalTime, laps, bestLapTime);
      if (averageTime) {
        const avgTs = averageTimeTimestamp(averageTime);
        if (avgTs != null) {
          updatedTiming.average_time = averageTime;
          updatedTiming.average_time_timestamp = avgTs;
        }
      }
    }

    updateFn(updatedTiming);
  };

  const handleEditTiming = (timing) => {
    const averageTime = calcAverage(timing.total_time, timing.laps, timing.best_lap_time);
    let average_time_timestamp = null;

    if (averageTime) {
      average_time_timestamp = averageTimeTimestamp(averageTime);
    }

    setEditingTiming({
      id: timing.id,
      best_lap_time: timing.best_lap_time,
      total_time: timing.total_time,
      laps: timing.laps,
      average_time: averageTime || timing.average_time,
      lane: timing.lane || '',
      circuit: timing.circuit || '',
      circuit_id: timing.circuit_id || '',
      timing_date: timing.timing_date,
      best_lap_timestamp: timing.best_lap_timestamp,
      total_time_timestamp: timing.total_time_timestamp,
      average_time_timestamp: average_time_timestamp || timing.average_time_timestamp,
      supply_voltage_volts:
        timing.supply_voltage_volts != null && timing.supply_voltage_volts !== ''
          ? String(timing.supply_voltage_volts)
          : '',
    });
  };

  const handleCancelEditTiming = () => {
    setEditingTiming(null);
    setNewTiming(emptyTiming());
  };

  const handleTimingVoltageBlur = async (timingId, raw) => {
    const trimmed = (raw ?? '').trim();
    const payload =
      trimmed === ''
        ? { supply_voltage_volts: null }
        : { supply_voltage_volts: parseFloat(trimmed.replace(',', '.')) };
    if (trimmed !== '' && !Number.isFinite(payload.supply_voltage_volts)) {
      setTimingNotice({ variant: 'warning', message: t('edit.errors.invalidVoltage') });
      setTimeout(() => setTimingNotice(null), 3000);
      return;
    }
    try {
      const { data } = await api.patch(`/timings/${timingId}`, payload);
      setTimings((prev) => prev.map((row) => (row.id === data.id ? { ...row, ...data } : row)));
    } catch (err) {
      console.error(err);
      setTimingNotice({
        variant: 'warning',
        message: err.response?.data?.error || t('edit.errors.saveVoltage'),
      });
      setTimeout(() => setTimingNotice(null), 4000);
    }
  };

  const handleAddTiming = async (e) => {
    e.preventDefault();
    try {
      let response;
      if (editingTiming) {
        response = await api.put(`/vehicles/${id}/timings/${editingTiming.id}`, editingTiming);

        if (response.data.position_updated) {
          const positionUpdates = response.data.position_updates || [];
          const successfulUpdates = positionUpdates.filter(u => u.success);

          if (successfulUpdates.length > 0) {
            const originalError = error;
            setError(null);
            const circuitNames = successfulUpdates.map(u => u.circuit).join(', ');
            setTimingNotice({
              variant: 'success',
              message: t('edit.notices.positionsUpdated', { circuits: circuitNames }),
            });
            setTimeout(() => {
              setTimingNotice(null);
              setError(originalError);
            }, 5000);
          }
        }
      } else {
        const { id: _omit, ...timingToCreate } = newTiming;
        response = await api.post(`/vehicles/${id}/timings`, timingToCreate);

        if (response.data.position_updated) {
          setTimingNotice({
            variant: 'success',
            message: t('edit.notices.newTimingPositions'),
          });
          setTimeout(() => {
            setTimingNotice(null);
          }, 5000);
        }
      }

      const reloadResponse = await api.get(`/vehicles/${id}/timings`);
      setTimings(reloadResponse.data);
      handleCancelEditTiming();
    } catch (err) {
      console.error('Error al guardar tiempo:', err);
      const backendError = err.response?.data?.error;
      const status = err.response?.status;
      if (status === 404 && editingTiming) {
        setError(backendError || t('edit.errors.timingNotFound'));
        const { id: _id, ...timingWithoutId } = editingTiming;
        setNewTiming({ ...timingWithoutId, circuit_id: editingTiming.circuit_id || '' });
        setEditingTiming(null);
      } else {
        setError(backendError || 'Error al guardar el tiempo');
      }
    }
  };

  const handleDeleteTiming = (timingId) => {
    setDeleteConfirm({ type: 'timing', timingId });
  };

  const confirmDeleteTiming = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'timing') return;
    const timingId = deleteConfirm.timingId;
    setDeleteConfirm(null);
    try {
      const response = await api.delete(`/vehicles/${id}/timings/${timingId}`);

      if (response.data.position_updated) {
        setTimingNotice({
          variant: 'success',
          message: `Tiempo eliminado y posiciones recalculadas en: ${response.data.circuit}`,
        });
        setTimeout(() => {
          setTimingNotice(null);
        }, 5000);
      }

      const reloadResponse = await api.get(`/vehicles/${id}/timings`);
      setTimings(reloadResponse.data);
    } catch (err) {
      console.error('Error al eliminar tiempo:', err);
      setError('Error al eliminar el registro de tiempo');
    }
  };

  const getTimingsByCircuitAndLane = () => {
    const grouped = {};

    timings.forEach(timing => {
      if (timing.circuit && timing.lane) {
        const key = `${timing.circuit}-${timing.lane}-${timing.laps || 'sin-vueltas'}`;
        if (!grouped[key]) {
          grouped[key] = {
            circuit: timing.circuit,
            lane: timing.lane,
            laps: timing.laps || 'N/A',
            timings: []
          };
        }
        grouped[key].timings.push(timing);
      }
    });

    return Object.values(grouped).filter(group => group.timings.length >= 2);
  };

  return {
    tTimings,
    timings,
    editingTiming,
    setEditingTiming,
    newTiming,
    setNewTiming,
    loadingTimings,
    trainingGoals,
    timingNotice,
    showSpecsModal,
    setShowSpecsModal,
    selectedTiming,
    setSelectedTiming,
    showPerformanceModal,
    setShowPerformanceModal,
    performanceTiming,
    setPerformanceTiming,
    timingHasLaps,
    showImportModal,
    setShowImportModal,
    loadTimings,
    handleTimingChange,
    handleEditTiming,
    handleCancelEditTiming,
    handleTimingVoltageBlur,
    handleAddTiming,
    handleDeleteTiming,
    confirmDeleteTiming,
    getTimingsByCircuitAndLane,
  };
}
