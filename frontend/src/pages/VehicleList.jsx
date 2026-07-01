import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import VehicleCard from '../components/VehicleCard';
import VehicleTable from '../components/VehicleTable';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/axios';
import { ArrowDownUp, Download, Plus, ChevronDown, LayoutGrid, Table as TableIcon, SlidersHorizontal, Upload } from 'lucide-react';
import { formatDistance } from '../utils/formatUtils';
import { getVehicleComponentTypeLabel } from '../data/componentTypes';
import { VEHICLE_TYPES } from '../data/vehicleTypes';
import { formatScaleLabel, mergeScaleDenominators } from '../data/vehicleScales';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import VehicleImportDialog from '../components/VehicleImportDialog';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ALL_VEHICLES_LIMIT = 10000;
const FILTERS_STORAGE_KEY = 'vehicleListFilters';
const SORT_STORAGE_KEY = 'vehicleListSort';

const SORT_KEYS = new Set([
  'purchase_date',
  'created_at',
  'total_distance_meters',
  'updated_at',
  'model',
]);

const loadStoredSort = () => {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (!raw) return { sort: 'purchase_date', dir: 'desc' };
    const parsed = JSON.parse(raw);
    const normalizedSort = parsed.sort === 'manufacturer' ? 'model' : parsed.sort;
    const sort = SORT_KEYS.has(normalizedSort) ? normalizedSort : 'purchase_date';
    const dir = parsed.dir === 'asc' || parsed.dir === 'desc' ? parsed.dir : 'desc';
    return { sort, dir };
  } catch {
    return { sort: 'purchase_date', dir: 'desc' };
  }
};

const saveSort = (next) => {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next));
  } catch {}
};

const defaultFilters = { manufacturer: '', type: '', modified: '', digital: '', scale: '', filterMuseo: false, filterTaller: false };

/** @param {URLSearchParams} searchParams */
function parseFiltersFromSearchParams(searchParams) {
  const patches = {};
  const mod = searchParams.get('modified');
  if (mod === 'Sí' || mod === 'No') patches.modified = mod;
  const dig = searchParams.get('digital');
  if (dig === 'Digital' || dig === 'Analógico') patches.digital = dig;
  const fm = searchParams.get('filterMuseo');
  if (fm === 'true' || fm === '1') patches.filterMuseo = true;
  const ft = searchParams.get('filterTaller');
  if (ft === 'true' || ft === '1') patches.filterTaller = true;
  const man = searchParams.get('manufacturer');
  if (man != null && String(man).trim() !== '') patches.manufacturer = String(man).slice(0, 200);
  const typ = searchParams.get('type');
  if (typ != null && String(typ).trim() !== '') patches.type = typ;
  const sc = searchParams.get('scale');
  if (sc != null && String(sc).trim() !== '') {
    const n = parseInt(String(sc).trim(), 10);
    if (Number.isFinite(n) && n > 0 && n <= 9999) patches.scale = String(n);
  }
  return Object.keys(patches).length ? { ...defaultFilters, ...patches } : null;
}

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
      scale: (() => {
        const s = parsed.scale;
        if (s == null || s === '') return '';
        const n = parseInt(String(s), 10);
        return Number.isFinite(n) && n > 0 && n <= 9999 ? String(n) : '';
      })(),
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
    const sc = filters.scale
      ? Number(v.scale_factor) === Number(filters.scale)
      : true;
    return m && t && mo && d && museoTaller && sc;
  });
};

const VehicleList = () => {
  const { t } = useTranslation('vehicles');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [userScaleDenominators, setUserScaleDenominators] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [filters, setFiltersState] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const fromUrl = parseFiltersFromSearchParams(params);
        if (fromUrl) {
          saveFilters(fromUrl);
          return fromUrl;
        }
      }
    } catch {
      /* ignore */
    }
    return loadStoredFilters();
  });
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
  const [importOpen, setImportOpen] = useState(false);
  /** null | 'csv' | 'pdf' — exportación en curso */
  const [exportingFormat, setExportingFormat] = useState(null);
  const [narrowPagination, setNarrowPagination] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false
  );
  const [pageSize, setPageSize] = useState(() => {
    try {
      const stored = parseInt(localStorage.getItem('vehiclePageSize'), 10);
      return PAGE_SIZE_OPTIONS.includes(stored) ? stored : 25;
    } catch { return 25; }
  });
  const [listSort, setListSortState] = useState(loadStoredSort);
  const setListSort = (next) => {
    setListSortState((prev) => {
      const n = typeof next === 'function' ? next(prev) : next;
      saveSort(n);
      return n;
    });
  };

  useEffect(() => {
    const fromUrl = parseFiltersFromSearchParams(searchParams);
    if (!fromUrl) return;
    setFiltersState(fromUrl);
    saveFilters(fromUrl);
  }, [searchParams]);

  const loadUserScaleDenominators = useCallback(async () => {
    try {
      const { data } = await api.get('/vehicles/scale-factors');
      const arr = Array.isArray(data?.scaleFactors) ? data.scaleFactors : [];
      setUserScaleDenominators(arr.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0));
    } catch (e) {
      console.error('Error al cargar escalas de la colección:', e);
    }
  }, []);

  useEffect(() => {
    loadUserScaleDenominators();
  }, [loadUserScaleDenominators]);

  const scaleDenominatorOptions = useMemo(
    () => mergeScaleDenominators(userScaleDenominators, filters.scale),
    [userScaleDenominators, filters.scale],
  );

  const hasActiveFilters = !!(filters.manufacturer || filters.type || filters.modified !== '' || filters.digital !== '' || filters.scale !== '' || filters.filterMuseo || filters.filterTaller);

  const sortQuery = `sort=${encodeURIComponent(listSort.sort)}&dir=${encodeURIComponent(listSort.dir)}`;

  const loadVehicles = useCallback(async (page = 1, limit = pageSize) => {
    try {
      const response = await api.get(`/vehicles?page=${page}&limit=${limit}&${sortQuery}`);
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
  }, [pageSize, sortQuery]);

  const loadAllVehicles = useCallback(async () => {
    try {
      const response = await api.get(`/vehicles?page=1&limit=${ALL_VEHICLES_LIMIT}&${sortQuery}`);
      const vehiclesData = Array.isArray(response.data.vehicles) ? response.data.vehicles : [];
      setAllVehicles(vehiclesData);
    } catch (error) {
      console.error('Error al cargar vehículos:', error);
      setAllVehicles([]);
    }
  }, [sortQuery]);

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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setNarrowPagination(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
    void loadUserScaleDenominators();
  };

  const handleImportedVehicles = () => {
    void loadUserScaleDenominators();
    if (hasActiveFilters) {
      void loadAllVehicles();
    } else {
      void loadVehicles(currentPage, pageSize);
    }
  };

  const handlePageChange = (page) => setCurrentPage(page);

  const filteredTotalPages = hasActiveFilters ? Math.ceil(filtered.length / pageSize) : pagination.totalPages;
  const filteredTotal = hasActiveFilters ? filtered.length : pagination.total;
  const displayVehicles = hasActiveFilters
    ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filtered;

  const buildExportQueryParams = () => {
    const params = new URLSearchParams();
    if (hasActiveFilters) {
      if (filters.manufacturer) params.set('manufacturer', filters.manufacturer);
      if (filters.type) params.set('type', filters.type);
      if (filters.modified) params.set('modified', filters.modified);
      if (filters.digital) params.set('digital', filters.digital);
      if (filters.filterMuseo) params.set('filterMuseo', 'true');
      if (filters.filterTaller) params.set('filterTaller', 'true');
      if (filters.scale) params.set('scale', filters.scale);
    }
    params.set('sort', listSort.sort);
    params.set('dir', listSort.dir);
    return params;
  };

  const exportToPDF = async () => {
    try {
      setExportingFormat('pdf');
      const params = buildExportQueryParams();
      const response = await api.get(`/vehicles/export-pdf?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `coleccion_vehiculos_${new Date().toISOString().split('T')[0]}.pdf`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar a PDF:', error);
      toast.error('Error al exportar el listado a PDF');
    } finally {
      setExportingFormat(null);
    }
  };

  const exportToCSV = async () => {
    try {
      setExportingFormat('csv');
      const params = buildExportQueryParams();
      const url = `/vehicles/export?${params.toString()}`;
      const response = await api.get(url);
      const vehiclesData = response.data.vehicles;
      const headers = [
        t('csvExport.id'),
        t('csvExport.model'),
        t('csvExport.reference'),
        t('csvExport.manufacturer'),
        t('csvExport.type'),
        t('csvExport.traction'),
        t('csvExport.scale'),
        t('csvExport.originalPrice'),
        t('csvExport.totalPrice'),
        t('csvExport.purchaseDate'),
        t('csvExport.purchasePlace'),
        t('csvExport.modified'),
        t('csvExport.digital'),
        t('csvExport.museum'),
        t('csvExport.workshop'),
        t('csvExport.odometer'),
        t('csvExport.notes'),
        t('csvExport.specs'),
        t('csvExport.modifications'),
      ];
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
            vehicle.modified ? t('yes') : t('no'),
            vehicle.digital ? t('yes') : t('no'),
            vehicle.museo ? t('yes') : t('no'),
            vehicle.taller ? t('yes') : t('no'),
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
      toast.error(t('csvExport.error'));
    } finally {
      setExportingFormat(null);
    }
  };

  const maxPages = narrowPagination ? 3 : 5;
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
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex border rounded-md p-0.5" role="group" aria-label={t('viewAria')}>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => handleViewModeChange('grid')}
              title={t('gridViewTitle')}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => handleViewModeChange('table')}
              title={t('tableViewTitle')}
            >
              <TableIcon className="size-4" />
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exportingFormat != null}>
                <Download className="size-4 mr-2" />
                {exportingFormat === 'csv'
                  ? t('exportingCsv')
                  : exportingFormat === 'pdf'
                    ? t('exportingPdf')
                    : t('export')}
                <ChevronDown className="size-4 ml-1 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void exportToCSV();
                }}
                disabled={exportingFormat != null}
              >
                {t('exportCsv')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void exportToPDF();
                }}
                disabled={exportingFormat != null}
              >
                {t('exportPdf')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4 mr-2" />
            {t('import')}
          </Button>
          <Button onClick={() => navigate('/vehicles/new')}>
            <Plus className="size-4 mr-2" />
            {t('add')}
          </Button>
        </div>
      </div>

      {/* Filtros y ordenación */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          {t('filtersAndSort')}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-manufacturer" className="text-xs font-medium text-muted-foreground">
              {t('manufacturer')}
            </label>
            <Input
              id="filter-manufacturer"
              placeholder={t('manufacturerPlaceholder')}
              value={filters.manufacturer}
              onChange={e => setFilters({ ...filters, manufacturer: e.target.value })}
              className="h-9"
            />
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs font-medium text-muted-foreground">
              {t('type')}
            </label>
            <select
              id="filter-type"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={filters.type}
              onChange={e => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">{t('allTypes')}</option>
              {VEHICLE_TYPES.map((typeName) => (
                <option key={typeName} value={typeName}>{typeName}</option>
              ))}
            </select>
          </div>

          {/* Escala */}
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-scale" className="text-xs font-medium text-muted-foreground">
              {t('scale')}
            </label>
            <select
              id="filter-scale"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={filters.scale}
              onChange={(e) => setFilters({ ...filters, scale: e.target.value })}
            >
              <option value="">{t('allScales')}</option>
              {scaleDenominatorOptions.map((d) => (
                <option key={d} value={String(d)}>
                  {formatScaleLabel(d)}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-modified" className="text-xs font-medium text-muted-foreground">
              {t('status')}
            </label>
            <select
              id="filter-modified"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={filters.modified}
              onChange={e => setFilters({ ...filters, modified: e.target.value })}
            >
              <option value="">{t('all')}</option>
              <option value="Sí">{t('modifiedYes')}</option>
              <option value="No">{t('modifiedNo')}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="filter-digital" className="text-xs font-medium text-muted-foreground">
              {t('system')}
            </label>
            <select
              id="filter-digital"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={filters.digital}
              onChange={e => setFilters({ ...filters, digital: e.target.value })}
            >
              <option value="">{t('all')}</option>
              <option value="Digital">{t('digital')}</option>
              <option value="Analógico">{t('analog')}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t('museumWorkshop')}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-between px-3 text-sm font-normal">
                  <span className="truncate text-left">
                    {!filters.filterMuseo && !filters.filterTaller
                      ? t('all')
                      : [filters.filterMuseo && t('museum'), filters.filterTaller && t('workshop')].filter(Boolean).join(', ')}
                  </span>
                  <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuCheckboxItem
                  checked={filters.filterMuseo}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, filterMuseo: !!checked }))}
                >
                  {t('museum')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.filterTaller}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, filterTaller: !!checked }))}
                >
                  {t('workshop')}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Ordenar por */}
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <label htmlFor="vehicle-list-sort" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ArrowDownUp className="size-3.5" aria-hidden />
              {t('sortBy')}
            </label>
            <select
              id="vehicle-list-sort"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={`${listSort.sort}|${listSort.dir}`}
              onChange={(e) => {
                const pipe = e.target.value.indexOf('|');
                const sort = e.target.value.slice(0, pipe);
                const dir = e.target.value.slice(pipe + 1);
                setListSort({ sort, dir });
                setCurrentPage(1);
              }}
            >
              <option value="model|asc">{t('sort.modelAsc')}</option>
              <option value="model|desc">{t('sort.modelDesc')}</option>
              <option value="purchase_date|desc">{t('sort.purchaseDesc')}</option>
              <option value="purchase_date|asc">{t('sort.purchaseAsc')}</option>
              <option value="created_at|desc">{t('sort.createdDesc')}</option>
              <option value="created_at|asc">{t('sort.createdAsc')}</option>
              <option value="total_distance_meters|asc">{t('sort.odometerAsc')}</option>
              <option value="total_distance_meters|desc">{t('sort.odometerDesc')}</option>
              <option value="updated_at|desc">{t('sort.updatedDesc')}</option>
              <option value="updated_at|asc">{t('sort.updatedAsc')}</option>
            </select>
          </div>

        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayVehicles.map(vehicle => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} onDelete={handleDeleteVehicle} onDuplicateSuccess={handleImportedVehicles} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <VehicleTable vehicles={displayVehicles} onDelete={handleDeleteVehicle} onDuplicateSuccess={handleImportedVehicles} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="text-sm text-muted-foreground order-2 sm:order-1">
          {filteredTotal > 0 ? (
            <>{t('showingRange', { start: rangeStart, end: rangeEnd, total: filteredTotal })}</>
          ) : (
            <>{hasActiveFilters ? t('noVehiclesFiltered') : t('noVehicles')}</>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 order-1 sm:order-2">
          {filteredTotalPages > 1 && (
            <>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>{t('previous')}</Button>
              {startPage > 1 && <Button variant="outline" size="sm" onClick={() => handlePageChange(1)}>1</Button>}
              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(n => (
                <Button key={n} variant={n === currentPage ? 'default' : 'outline'} size="sm" onClick={() => handlePageChange(n)}>{n}</Button>
              ))}
              {endPage < filteredTotalPages && <Button variant="outline" size="sm" onClick={() => handlePageChange(filteredTotalPages)}>{filteredTotalPages}</Button>}
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === filteredTotalPages}>{t('next')}</Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 order-3">
          <label htmlFor="page-size" className="text-sm text-muted-foreground whitespace-nowrap">{t('perPage')}</label>
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

      <VehicleImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImportedVehicles}
      />
    </div>
  );
};

export default VehicleList;
