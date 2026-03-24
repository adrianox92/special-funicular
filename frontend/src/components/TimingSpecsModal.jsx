import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatDistance, modificationLineTotal } from '../utils/formatUtils';
import { getVehicleComponentTypeLabel } from '../data/componentTypes';
import LapBreakdownChart from './charts/LapBreakdownChart';
import api from '../lib/axios';

const TimingSpecsModal = ({ show, onHide, setupSnapshot, timing }) => {
  const [laps, setLaps] = useState([]);

  useEffect(() => {
    if (show && timing?.id) {
      api.get(`/timings/${timing.id}/laps`)
        .then((r) => setLaps(r.data?.laps || []))
        .catch(() => setLaps([]));
    } else {
      setLaps([]);
    }
  }, [show, timing?.id]);

  if (!setupSnapshot || !timing) return null;

  const specs = JSON.parse(setupSnapshot);

  const groupByComponentType = (specs) => {
    const groups = {};
    specs.forEach(spec => {
      if (!groups[spec.component_type]) {
        groups[spec.component_type] = [];
      }
      groups[spec.component_type].push(spec);
    });
    return groups;
  };

  const getColumnsForType = (type) => {
    const baseColumns = ['Componente', 'Fabricante', 'Referencia', 'Material', 'Tamaño', 'Importe'];
    switch (type) {
      case 'motor':
        return [...baseColumns.slice(0, 5), 'RPM', 'Gaus', ...baseColumns.slice(5)];
      case 'crown':
      case 'pinion':
        return [...baseColumns.slice(0, 5), 'Dientes', ...baseColumns.slice(5)];
      default:
        return baseColumns;
    }
  };

  const renderComponentCell = (component, column) => {
    switch (column) {
      case 'Componente':
        return component.url ? (
          <a href={component.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {component.element}
          </a>
        ) : component.element;
      case 'Fabricante':
        return component.manufacturer || '-';
      case 'Referencia':
        return component.sku || '-';
      case 'Importe': {
        if (component.price == null || component.price === '') return '-';
        const pu = Number(component.price);
        if (Number.isNaN(pu)) return '-';
        let q = parseInt(component.mounted_qty, 10);
        if (Number.isNaN(q) || q < 1) q = 1;
        const line = modificationLineTotal(component.price, component.mounted_qty);
        if (q <= 1) return `€${pu.toFixed(2)} (u.)`;
        return `${q} × €${pu.toFixed(2)} = €${line.toFixed(2)}`;
      }
      case 'RPM':
        return component.rpm || '-';
      case 'Gaus':
        return component.gaus || '-';
      case 'Dientes':
        return component.teeth || '-';
      case 'Material':
        return component.material || '-';
      case 'Tamaño':
        return component.size || '-';
      default:
        return '-';
    }
  };

  const groupedSpecs = groupByComponentType(specs);

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onHide()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <div>
              <div>Especificaciones Técnicas</div>
              <small className="text-muted-foreground font-normal block mt-1">
                {timing.vehicle_manufacturer} {timing.vehicle_model} - {new Date(timing.timing_date).toLocaleDateString()}
              </small>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <h6 className="font-semibold mb-3">Resumen de la Sesión</h6>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <strong className="text-sm text-muted-foreground">Mejor Vuelta</strong>
                <div className="font-mono font-medium">{timing.best_lap_time}</div>
              </div>
              <div>
                <strong className="text-sm text-muted-foreground">Tiempo Total</strong>
                <div className="font-mono font-medium">{timing.total_time}</div>
              </div>
              <div>
                <strong className="text-sm text-muted-foreground">Vueltas</strong>
                <div>{timing.laps}</div>
              </div>
              <div>
                <strong className="text-sm text-muted-foreground">Circuito</strong>
                <div>{timing.circuit || '-'} (Carril {timing.lane || '-'})</div>
              </div>
              {timing.total_distance_meters != null && (
                <div>
                  <strong className="text-sm text-muted-foreground">Distancia</strong>
                  <div>{formatDistance(timing.total_distance_meters)}</div>
                </div>
              )}
              {timing.avg_speed_kmh != null && timing.avg_speed_scale_kmh != null && (
                <div>
                  <strong className="text-sm text-muted-foreground">Velocidad</strong>
                  <div>{Number(timing.avg_speed_kmh).toFixed(1)} km/h ({Number(timing.avg_speed_scale_kmh).toFixed(0)} km/h eq.)</div>
                </div>
              )}
              {timing.consistency_score != null && (
                <div>
                  <strong className="text-sm text-muted-foreground">Consistencia</strong>
                  <div className={timing.consistency_score < 5 ? 'text-green-600' : timing.consistency_score > 15 ? 'text-destructive' : ''}>
                    {Number(timing.consistency_score).toFixed(2)}%
                  </div>
                </div>
              )}
              {timing.worst_lap_timestamp != null && (
                <div>
                  <strong className="text-sm text-muted-foreground">Peor vuelta</strong>
                  <div className="font-mono">
                    {(() => {
                      const s = timing.worst_lap_timestamp;
                      const mins = Math.floor(s / 60);
                      const secs = (s % 60).toFixed(3);
                      return `${String(mins).padStart(2, '0')}:${secs.padStart(6, '0')}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {laps.length > 0 && (
            <LapBreakdownChart laps={laps} bestLapTimestamp={timing.best_lap_timestamp ?? undefined} />
          )}

          <h6 className="font-semibold">Componentes del Vehículo</h6>
          {Object.entries(groupedSpecs).map(([type, components]) => (
            <div key={type} className="space-y-2">
              <h5 className="font-medium">{getVehicleComponentTypeLabel(type)}</h5>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {getColumnsForType(type).map(column => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {components.map(component => (
                      <TableRow key={component.id}>
                        {getColumnsForType(type).map(column => (
                          <TableCell key={`${component.id}-${column}`}>
                            {renderComponentCell(component, column)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onHide}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimingSpecsModal;
