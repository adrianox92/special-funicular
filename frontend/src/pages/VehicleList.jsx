import React, { useState, useEffect, useCallback } from 'react';
import VehicleCard from '../components/VehicleCard';
import VehicleTable from '../components/VehicleTable';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Download, Plus, ChevronDown, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { formatDistance } from '../utils/formatUtils';
import { getVehicleComponentTypeLabel } from '../data/componentTypes';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ALL_VEHICLES_LIMIT = 10000;
const FILTERS_STORAGE_KEY = 'vehicleListFilters';

const defaultFilters = { manufacturer: '', type: '', modified: '', digital: '', filterMuseo: false, filterTaller: false };

const loadStoredFilters = () => {
  try {
    const stored = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!stored) return defaultFilters;
    const parsed = JSON.parse(stored);
    return {
      manufacturer: String(parsed.manufacturer ?? '').slice(0, 200),
      type: typeof parsed.type === 'string' ? parsed.type : '',
      modified: typeof parsed.modified === 'string' ? parsed.modified : '',
      digital: typeof parsed.digital === 'string' ? parsed.digital : '',
      filterMuseo: Boolean(parsed.filterMuseo),
      filterTaller: Boolean(parsed.filterTaller),
    };
  } catch {
    return defaultFilters;
  }
};

const saveFilters = (filters) => {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {}
};

const applyFilters = (list, filters) => {
  return list.filter(v => {
    const m = filters.manufacturer ? v.manufacturer?.toLowerCase().includes(filters.manufacturer.toLowerCase()) : true;
    const t = filters.type ? v.type === filters.type : true;
    const mo = filters.modified === '' ? true : filters.modified === 'Sí' ? v.modified : !v.modified;
    const d = filters.digital === '' ? true : filters.digital === 'Digital' ? v.digital : !v.digital;
    const museoTaller = !filters.filterMuseo && !filters.filterTaller
      ? true
      : filters.filterMuseo && filters.filterTaller
        ? (v.museo || v.taller)
        : filters.filterMuseo
          ? v.museo
          : v.taller;
    return m && t && mo && d && museoTaller;
  });
};

const VehicleList = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [filters, setFiltersState] = useState(loadStoredFilters);
  const setFilters = (updater) => {
    setFiltersState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveFilters(next);
      return next;
    });
  };
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('vehicleViewMode') || 'grid'; } catch { return 'grid'; }
  });
  const [pageSize, setPageSize] = useState(() => {
    try {
      const stored = parseInt(localStorage.getItem('vehiclePageSize'), 10);
      return PAGE_SIZE_OPTIONS.includes(stored) ? stored : 25;
    } catch { return 25; }
  });

  const hasActiveFilters = !!(filters.manufacturer || filters.type || filters.modified !== '' || filters.digital !== '' || filters.filterMuseo || filters.filterTaller);

  const loadVehicles = useCallback(async (page = 1, limit = pageSize) => {
    try {
      const response = await api.get(`/vehicles?page=${page}&limit=${limit}`);
      const vehiclesData = Array.isArray(response.data.vehicles) ? response.data.vehicles : [];
      setVehicles(vehiclesData);
      setFiltered(vehiclesData);
      setPagination(response.data.pagination || { total: 0, page: 1, limit, totalPages: 0 });
    } catch (error) {
      console.error('Error al cargar vehículos:', error);
      setVehicles([]);
      setFiltered([]);
      setPagination({ total: 0, page: 1, limit, totalPages: 0 });
    }
  }, [pageSize]);

  const loadAllVehicles = useCallback(async () => {
    try {
      const response = await api.get(`/vehicles?page=1&limit=${ALL_VEHICLES_LIMIT}`);
      const vehiclesData = Array.isArray(response.data.vehicles) ? response.data.vehicles : [];
      setAllVehicles(vehiclesData);
    } catch (error) {
      console.error('Error al cargar vehículos:', error);
      setAllVehicles([]);
    }
  }, []);

  useEffect(() => {
    if (hasActiveFilters) {
      setCurrentPage(1);
      loadAllVehicles();
    } else {
      setAllVehicles([]);
      setCurrentPage(1);
    }
  }, [hasActiveFilters, loadAllVehicles]);

  useEffect(() => {
    if (!hasActiveFilters) {
      loadVehicles(currentPage, pageSize);
    }
  }, [currentPage, pageSize, hasActiveFilters, loadVehicles]);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem('vehicleViewMode', mode); } catch {}
  };

  const handlePageSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setPageSize(value);
    setCurrentPage(1);
    try { localStorage.setItem('vehiclePageSize', String(value)); } catch {}
  };

  useEffect(() => {
    const source = hasActiveFilters ? allVehicles : vehicles;
    const result = applyFilters(source, filters);
    setFiltered(result);
    if (hasActiveFilters) setCurrentPage(1);
  }, [filters, vehicles, allVehicles, hasActiveFilters]);

  const handleDeleteVehicle = (vehicleId) => {
    setVehicles(prev => prev.filter(v => v.id !== vehicleId));
    setFiltered(prev => prev.filter(v => v.id !== vehicleId));
    if (hasActiveFilters) setAllVehicles(prev => prev.filter(v => v.id !== vehicleId));
  };

  const handlePageChange = (page) => setCurrentPage(page);

  const filteredTotalPages = hasActiveFilters ? Math.ceil(filtered.length / pageSize) : pagination.totalPages;
  const filteredTotal = hasActiveFilters ? filtered.length : pagination.total;
  const displayVehicles = hasActiveFilters
    ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filtered;

  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (hasActiveFilters) {
        if (filters.manufacturer) params.set('manufacturer', filters.manufacturer);
        if (filters.type) params.set('type', filters.type);
        if (filters.modified) params.set('modified', filters.modified);
        if (filters.digital) params.set('digital', filters.digital);
        if (filters.filterMuseo) params.set('filterMuseo', 'true');
        if (filters.filterTaller) params.set('filterTaller', 'true');
      }
      const url = params.toString() ? `/vehicles/export?${params.toString()}` : '/vehicles/export';
      const response = await api.get(url);
      const vehiclesData = response.data.vehicles;
      const headers = ['ID', 'Modelo', 'Referencia', 'Fabricante', 'Tipo', 'Tracción', 'Escala', 'Precio Original (€)', 'Precio Total (€)', 'Fecha de Compra', 'Lugar de Compra', 'Modificado', 'Digital', 'Museo', 'Taller', 'Odómetro', 'Anotaciones', 'Especificaciones Técnicas', 'Modificaciones'];
      const vehiclesWithDetails = await Promise.all(vehiclesData.map(async (vehicle) => {
        const [specsResponse, modsResponse] = await Promise.all([
          api.get(`/vehicles/${vehicle.id}/specs`),
          api.get(`/vehicles/${vehicle.id}/modifications`)
        ]);
        return { ...vehicle, specs: specsResponse.data, modifications: modsResponse.data };
      }));
      const escapeCsv = (v) => {
        const s = v == null || v === 'null' || v === 'undefined' ? '' : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csvContent = [
        headers.join(','),
        ...vehiclesWithDetails.map(vehicle => {
          const specs = vehicle.specs
            .map(
              (s) =>
                `${getVehicleComponentTypeLabel(s.component_type)}: ${s.element} (${s.manufacturer})`,
            )
            .join('; ');
          const mods = vehicle.modifications
            .map(
              (m) =>
                `${getVehicleComponentTypeLabel(m.component_type)}: ${m.element} (${m.manufacturer}) - ${m.price}€`,
            )
            .join('; ');
          const scaleStr = vehicle.scale_factor ? `1:${vehicle.scale_factor}` : '';
          const odometerStr = formatDistance(vehicle.total_distance_meters);
          const anotaciones = vehicle.anotaciones != null && vehicle.anotaciones !== '' && String(vehicle.anotaciones) !== 'null' ? String(vehicle.anotaciones) : '';
          return [
            vehicle.id,
            escapeCsv(vehicle.model),
            escapeCsv(vehicle.reference),
            escapeCsv(vehicle.manufacturer),
            escapeCsv(vehicle.type),
            escapeCsv(vehicle.traction),
            escapeCsv(scaleStr),
            vehicle.price ?? '',
            vehicle.total_price ?? '',
            vehicle.purchase_date || '',
            escapeCsv(vehicle.purchase_place),
            vehicle.modified ? 'Sí' : 'No',
            vehicle.digital ? 'Sí' : 'No',
            vehicle.museo ? 'Sí' : 'No',
            vehicle.taller ? 'Sí' : 'No',
            escapeCsv(odometerStr),
            escapeCsv(anotaciones),
            escapeCsv(specs),
            escapeCsv(mods)
          ].join(',');
        })
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `coleccion_vehiculos_${new Date().toISOString().split('T')[0]}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error al exportar a CSV:', error);
      toast.error('Error al exportar los datos a CSV');
    }
  };

  const maxPages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
  let endPage = Math.min(filteredTotalPages, startPage + maxPages - 1);
  if (endPage - startPage + 1 < maxPages) startPage = Math.max(1, endPage - maxPages + 1);

  const rangeStart = filteredTotal > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = hasActiveFilters
    ? Math.min(currentPage * pageSize, filteredTotal)
    : Math.min(currentPage * pagination.limit, filteredTotal);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Mi Colección</h1>
        <div className="flex gap-2 items-center">
          <div className="flex border rounded-md p-0.5" role="group" aria-label="Vista">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => handleViewModeChange('grid')}
              title="Vista cuadrícula"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => handleViewModeChange('table')}
              title="Vista tabla"
            >
              <TableIcon className="size-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="size-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => navigate('/vehicles/new')}>
            <Plus className="size-4 mr-2" />
            Añadir Vehículo
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Input placeholder="Buscar por fabricante..." value={filters.manufacturer} onChange={e => setFilters({ ...filters, manufacturer: e.target.value })} className="min-w-[140px] flex-1" />
        <select className="flex h-9 min-w-[140px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Todos los tipos</option>
          {['Rally', 'GT', 'LMP', 'Hypercar', 'Grupo 5', 'Road Car', 'Clásico', 'DTM', 'F1', 'Camiones', 'Raid'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="flex h-9 min-w-[140px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.modified} onChange={e => setFilters({ ...filters, modified: e.target.value })}>
          <option value="">Modificado/Serie</option>
          <option value="Sí">Modificado</option>
          <option value="No">Serie</option>
        </select>
        <select className="flex h-9 min-w-[140px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.digital} onChange={e => setFilters({ ...filters, digital: e.target.value })}>
          <option value="">Digital/Analógico</option>
          <option value="Digital">Digital</option>
          <option value="Analógico">Analógico</option>
        </select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 min-w-[140px] flex-1 justify-between px-3 text-sm font-normal">
              <span className="truncate">
                {!filters.filterMuseo && !filters.filterTaller
                  ? 'Museo / Taller'
                  : [filters.filterMuseo && 'Museo', filters.filterTaller && 'Taller'].filter(Boolean).join(', ')}
              </span>
              <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
            <DropdownMenuCheckboxItem
              checked={filters.filterMuseo}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, filterMuseo: !!checked }))}
            >
              Museo
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filters.filterTaller}
              onCheckedChange={(checked) => setFilters(prev => ({ ...prev, filterTaller: !!checked }))}
            >
              Taller
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayVehicles.map(vehicle => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} onDelete={handleDeleteVehicle} />
          ))}
        </div>
      ) : (
        <VehicleTable vehicles={displayVehicles} onDelete={handleDeleteVehicle} />
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="text-sm text-muted-foreground order-2 sm:order-1">
          {filteredTotal > 0 ? (
            <>Mostrando {rangeStart}–{rangeEnd} de {filteredTotal} vehículos</>
          ) : (
            <>No hay vehículos</>
          )}
        </div>
        <div className="flex items-center gap-2 order-1 sm:order-2">
          {filteredTotalPages > 1 && (
            <>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Anterior</Button>
              {startPage > 1 && <Button variant="outline" size="sm" onClick={() => handlePageChange(1)}>1</Button>}
              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(n => (
                <Button key={n} variant={n === currentPage ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(n)}>{n}</Button>
              ))}
              {endPage < filteredTotalPages && <Button variant="outline" size="sm" onClick={() => handlePageChange(filteredTotalPages)}>{filteredTotalPages}</Button>}
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === filteredTotalPages}>Siguiente</Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 order-3">
          <label htmlFor="page-size" className="text-sm text-muted-foreground whitespace-nowrap">Por página:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="flex h-9 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default VehicleList;
