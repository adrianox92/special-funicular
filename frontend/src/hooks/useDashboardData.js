import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../lib/axios';

const defaultMetrics = {
  totalVehicles: 0,
  modifiedVehicles: 0,
  stockVehicles: 0,
  digitalVehicles: 0,
  museoVehicles: 0,
  tallerVehicles: 0,
  totalInvestment: 0,
  averageInvestmentPerVehicle: 0,
  averagePriceIncrement: 0,
  lastUpdate: null,
  highestIncrementVehicle: null,
  bestTimeVehicle: null,
  investmentHistory: [],
  performanceByType: {},
  trends: {},
  activeCompetitions: 0,
};

const defaultCharts = {
  vehiclesByType: [],
  modificationStats: { modified: 0, stock: 0 },
  topCostVehicles: [],
  topComponents: [],
  brandDistribution: [],
  storeDistribution: [],
};

function perfDebug(label, startedAt) {
  if (process.env.NODE_ENV === 'production' || typeof performance === 'undefined') return;
  try {
    const ms = performance.now() - startedAt;
    // eslint-disable-next-line no-console
    console.debug(`[dashboard] ${label}: ${ms.toFixed(0)}ms`);
  } catch (_) {
    /* ignore */
  }
}

/**
 * Carga métricas, gráficos, acciones del dashboard y resumen de mantenimiento.
 */
export function useDashboardData() {
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [chartsData, setChartsData] = useState(defaultCharts);
  const [actionItems, setActionItems] = useState(null);
  const [maintenanceSummary, setMaintenanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionItemsError, setActionItemsError] = useState(null);
  const [maintenanceError, setMaintenanceError] = useState(null);
  const hasLoadedOnceRef = useRef(false);

  const fetchAll = useCallback(async () => {
    const isFirstLoad = !hasLoadedOnceRef.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    setActionItemsError(null);
    setMaintenanceError(null);

    const tAll = typeof performance !== 'undefined' ? performance.now() : 0;

    try {
      const tBatch = typeof performance !== 'undefined' ? performance.now() : 0;
      const [metricsResponse, chartsResponse, actionResult, maintResult] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/dashboard/charts'),
        api.get('/dashboard/action-items').then(
          (r) => ({ ok: true, data: r.data }),
          (actionErr) => {
            // eslint-disable-next-line no-console
            console.error('Error al cargar acciones del dashboard:', actionErr);
            return { ok: false, data: null };
          },
        ),
        api.get('/dashboard/maintenance-summary').then(
          (r) => ({ ok: true, data: r.data }),
          (maintErr) => {
            // eslint-disable-next-line no-console
            console.error('Error al cargar mantenimiento del dashboard:', maintErr);
            return { ok: false, data: null };
          },
        ),
      ]);

      perfDebug('parallel fetch (metrics+charts+action-items+maintenance)', tBatch);

      setMetrics({ ...defaultMetrics, ...metricsResponse.data });
      setChartsData({ ...defaultCharts, ...chartsResponse.data });

      if (actionResult.ok) {
        setActionItems(actionResult.data);
        setActionItemsError(false);
      } else {
        setActionItems(null);
        setActionItemsError(true);
      }

      if (maintResult.ok) {
        setMaintenanceSummary(maintResult.data);
        setMaintenanceError(false);
      } else {
        setMaintenanceSummary(null);
        setMaintenanceError(true);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error al cargar datos del dashboard:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      perfDebug('fetchAll total', tAll);
      if (isFirstLoad) {
        setLoading(false);
        hasLoadedOnceRef.current = true;
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    metrics,
    chartsData,
    actionItems,
    actionItemsError,
    maintenanceSummary,
    maintenanceError,
    loading,
    isRefreshing,
    error,
    refetch: fetchAll,
  };
}
