import React, { useState, useMemo } from 'react';
import { ExternalLink, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { getVehicleComponentTypeLabel } from '../../data/componentTypes';
import { formatCurrencyEur } from '../../utils/formatUtils';

const formatCurrency = (value) =>
  formatCurrencyEur(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const TopComponentsTable = ({ data }) => {
  const [sortConfig, setSortConfig] = useState({
    key: 'totalInvestment',
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

  const renderComponentLinks = (component) => {
    if (!component.urls || component.urls.length === 0) {
      return component.name;
    }
    if (component.urls.length === 1) {
      return (
        <a href={component.urls[0]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
          {component.name}
          <ExternalLink className="size-3.5" />
        </a>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto p-0 font-normal inline-flex items-center gap-1 hover:underline">
            {component.name}
            <ExternalLink className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {component.urls.map((url, index) => (
            <DropdownMenuItem key={index} asChild>
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                Enlace {index + 1}
                <ExternalLink className="size-3.5" />
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">Top 10 Componentes más Utilizados</h5></CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Componente</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('unitPrice')}>
                  <span className="inline-flex items-center gap-1">
                    Precio Unitario {getSortIcon('unitPrice')}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('totalInvestment')}>
                  <span className="inline-flex items-center gap-1">
                    Inversión Total {getSortIcon('totalInvestment')}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((component) => (
                <TableRow key={component.id}>
                  <TableCell>{getVehicleComponentTypeLabel(component.component_type)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {renderComponentLinks(component)}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="cursor-help">{component.usageCount}</Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-left max-w-xs">
                            <strong>Vehículos que lo utilizan:</strong>
                            {component.vehicles?.map((vehicle, index) => (
                              <div key={index} className="mt-1 text-sm">{vehicle.manufacturer} {vehicle.model}</div>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                  <TableCell>{component.sku}</TableCell>
                  <TableCell>{formatCurrency(component.unitPrice)}</TableCell>
                  <TableCell>{formatCurrency(component.totalInvestment)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TopComponentsTable; 