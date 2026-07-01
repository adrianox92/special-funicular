import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { formatCurrencyEur, formatPercent } from '../../utils/formatUtils';

const formatCurrency = (value) =>
  formatCurrencyEur(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const TopCostTable = ({ data }) => {
  const { t } = useTranslation('dashboard');
  const [sortConfig, setSortConfig] = useState({
    key: 'incrementPercentage',
    direction: 'desc'
  });

  const IncrementBar = ({ value, maxValue, basePrice, totalPrice }) => {
    const width = Math.min(Math.abs(value) / maxValue * 100, 100);

    const getColor = (val, averageIncrement) => {
      if (val <= 0) return '#6c757d';
      if (val > averageIncrement * 1.5) return '#198754';
      if (val > averageIncrement) return '#fd7e14';
      return '#dc3545';
    };

    const color = getColor(value, maxValue / 2);

    return (
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
              {formatPercent(value)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-left">
          <div>{t('tables.topCost.originalCost', { value: formatCurrency(basePrice) })}</div>
          <div className="flex items-center gap-1">
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
            {t('tables.topCost.total', { value: formatCurrency(totalPrice) })}
          </div>
          <div className="font-semibold">
            {t('tables.topCost.incrementLabel', { value: formatPercent(value) })}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

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

  const maxIncrement = data.length ? Math.max(...data.map(item => Math.abs(item.incrementPercentage)), 1) : 1;

  return (
    <Card className="h-full">
      <CardHeader><h5 className="font-semibold">{t('tables.topCost.title')}</h5></CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={300}>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tables.topCost.model')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('basePrice')}>
                  <span className="inline-flex items-center gap-1">
                    {t('tables.topCost.basePrice')} {getSortIcon('basePrice')}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('totalPrice')}>
                  <span className="inline-flex items-center gap-1">
                    {t('tables.topCost.totalPrice')} {getSortIcon('totalPrice')}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('incrementPercentage')}>
                  <span className="inline-flex items-center gap-1">
                    {t('tables.topCost.increment')} {getSortIcon('incrementPercentage')}
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
                      {vehicle.modified && (
                        <Badge variant="default">{t('tables.topCost.modBadge')}</Badge>
                      )}
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
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default TopCostTable;
