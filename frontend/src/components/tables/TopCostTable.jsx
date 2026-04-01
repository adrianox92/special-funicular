import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { formatCurrencyEur } from '../../utils/formatUtils';

const formatCurrency = (value) =>
  formatCurrencyEur(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatPercentage = (value) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);
};

const IncrementBar = ({ value, maxValue, basePrice, totalPrice }) => {
  const width = Math.min(Math.abs(value) / maxValue * 100, 100);
  
  // Determinar el color basado en el valor
  const getColor = (value, averageIncrement) => {
    if (value <= 0) return '#6c757d'; // Gris para valores negativos o cero
    if (value > averageIncrement * 1.5) return '#198754'; // Verde para incrementos altos
    if (value > averageIncrement) return '#fd7e14'; // Naranja para incrementos medios
    return '#dc3545'; // Rojo para incrementos bajos
  };

  const color = getColor(value, maxValue / 2); // Usamos la mitad del máximo como promedio aproximado
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <div className="w-[60px] h-2 bg-muted rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-sm" style={{ color, fontWeight: value > 0 ? 'bold' : 'normal' }}>
              {formatPercentage(value)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-left">
          <div>Coste original: {formatCurrency(basePrice)}</div>
          <div className="flex items-center gap-1">
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
            Total: {formatCurrency(totalPrice)}
          </div>
          <div className="font-semibold">Incremento: {formatPercentage(value)}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TopCostTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({
    key: 'incrementPercentage',
    direction: 'desc'
  });

  const sortedData = useMemo(() => {
    const sorted = [...data];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [data, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    const cls = 'inline size-3.5 align-middle opacity-70';
    if (sortConfig.key !== key) return <ArrowUpDown className={cls} aria-hidden />;
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className={cls} aria-hidden />
    ) : (
      <ArrowDown className={cls} aria-hidden />
    );
  };

  // Calcular el máximo incremento para escalar las barras
  const maxIncrement = data.length ? Math.max(...data.map(item => Math.abs(item.incrementPercentage)), 1) : 1;

  return (
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">Top 5 Vehículos por Coste</h5></CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('basePrice')}>
                  <span className="inline-flex items-center gap-1">
                    Precio Base {getSortIcon('basePrice')}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('totalPrice')}>
                  <span className="inline-flex items-center gap-1">
                    Precio Total {getSortIcon('totalPrice')}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('incrementPercentage')}>
                  <span className="inline-flex items-center gap-1">
                    Incremento {getSortIcon('incrementPercentage')}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link to={`/vehicles/${vehicle.id}`} className="hover:underline">
                        {`${vehicle.manufacturer} ${vehicle.model}`}
                      </Link>
                      {vehicle.modified && <Badge variant="default">Mod</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(vehicle.basePrice)}</TableCell>
                  <TableCell>{formatCurrency(vehicle.totalPrice)}</TableCell>
                  <TableCell>
                    <IncrementBar
                      value={vehicle.incrementPercentage}
                      maxValue={maxIncrement}
                      basePrice={vehicle.basePrice}
                      totalPrice={vehicle.totalPrice}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopCostTable; 