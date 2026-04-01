import { useState, useEffect, useCallback } from 'react';
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

/**
 * Carga métricas, gráficos, acciones del dashboard y resumen de mantenimiento.
 */
export function useDashboardData() {
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [chartsData, setChartsData] = useState(defaultCharts);
  const [actionItems, setActionItems] = useState(null);
  const [maintenanceSummary, setMaintenanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionItemsError, setActionItemsError] = useState(null);
  const [maintenanceError, setMaintenanceError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionItemsError(null);
    setMaintenanceError(null);
    try {
      const [metricsResponse, chartsResponse] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/dashboard/charts'),
      ]);
      setMetrics({ ...defaultMetrics, ...metricsResponse.data });
      setChartsData({ ...defaultCharts, ...chartsResponse.data });

      try {
        const actionResponse = await api.get('/dashboard/action-items');
        setActionItems(actionResponse.data);
        setActionItemsError(false);
      } catch (actionErr) {
        console.error('Error al cargar acciones del dashboard:', actionErr);
        setActionItems(null);
        setActionItemsError(true);
      }

      try {
        const maintResponse = await api.get('/dashboard/maintenance-summary');
        setMaintenanceSummary(maintResponse.data);
      } catch (maintErr) {
        console.error('Error al cargar mantenimiento del dashboard:', maintErr);
        setMaintenanceSummary(null);
        setMaintenanceError(true);
      }
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
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
    error,
    refetch: fetchAll,
  };
}
