import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pencil,
  Trash2,
  Wrench,
  BarChart3,
  AlertTriangle,
  CircleCheck,
  Upload,
} from 'lucide-react';
import api from '../../lib/axios';
import TimingEvolutionChart from '../charts/TimingEvolutionChart';
import SpeedEvolutionChart from '../charts/SpeedEvolutionChart';
import VoltagePerformanceChart from '../charts/VoltagePerformanceChart';
import ImportTimingsModal from '../ImportTimingsModal';
import LapTimerTrainingCard from '../LapTimerTrainingCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { getRecordedFromLabel } from '../../utils/recordedFromLabel';
import { TimeInput, TimeInputHint } from '../ui/TimeInput';
import { Label } from '../ui/label';
import { Alert } from '../ui/alert';
import { Spinner } from '../ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { cn } from '../ui/utils';
import { formatDistance, formatCircuitSelectLabel } from '../../utils/formatUtils';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleTimingsTab() {
  const { t } = useTranslation('vehicles');
  const { t: tCommon } = useTranslation('common');
  const {
    id,
    vehicle,
    circuits,
    tTimings,
    timings,
    editingTiming,
    setEditingTiming,
    newTiming,
    setNewTiming,
    loadingTimings,
    trainingGoals,
    timingNotice,
    setShowSpecsModal,
    setSelectedTiming,
    setShowPerformanceModal,
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
    getTimingsByCircuitAndLane,
  } = useEditVehicle();

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setShowImportModal(true)}>
          <Upload className="size-4 mr-2" />
          {tTimings('import')}
        </Button>
      </div>
      <ImportTimingsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        vehicles={
          vehicle
            ? [{ id: vehicle.id, manufacturer: vehicle.manufacturer, model: vehicle.model }]
            : []
        }
        circuits={circuits}
        fixedVehicleId={id}
        onImported={loadTimings}
      />
      <LapTimerTrainingCard vehicleId={id} circuits={circuits} />
      <h4 className="text-lg font-semibold">
        {editingTiming ? t('edit.timings.editRecord') : t('edit.timings.addRecord')}
      </h4>
      {timingNotice && (
        <Alert
          className={cn(
            'mb-4 flex items-start gap-2',
            timingNotice.variant === 'success'
              ? 'border-green-500/50 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200'
              : 'border-amber-500/50 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
          )}
        >
          {timingNotice.variant === 'success' ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>{timingNotice.message}</span>
        </Alert>
      )}
      <form onSubmit={handleAddTiming}>
        <TimeInputHint className="mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="best_lap_time">{t('edit.timings.bestLap')}</Label>
            <TimeInput
              id="best_lap_time"
              name="best_lap_time"
              value={editingTiming?.best_lap_time || newTiming.best_lap_time}
              onChange={(val) =>
                handleTimingChange({ target: { name: 'best_lap_time', value: val } })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_time">{t('edit.timings.totalTime')}</Label>
            <TimeInput
              id="total_time"
              name="total_time"
              value={editingTiming?.total_time || newTiming.total_time}
              onChange={(val) =>
                handleTimingChange({ target: { name: 'total_time', value: val } })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="laps">{t('edit.timings.laps')}</Label>
            <Input
              id="laps"
              name="laps"
              type="number"
              value={editingTiming?.laps || newTiming.laps}
              onChange={handleTimingChange}
              required
              min="1"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="average_time">{t('edit.timings.averageTime')}</Label>
            <Input
              id="average_time"
              name="average_time"
              value={editingTiming?.average_time || newTiming.average_time}
              readOnly
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">{t('edit.timings.autoCalculated')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lane">{t('edit.timings.lane')}</Label>
            <Input id="lane" name="lane" value={editingTiming?.lane || newTiming.lane} onChange={handleTimingChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timing_date">{t('edit.timings.date')}</Label>
            <Input
              id="timing_date"
              name="timing_date"
              type="date"
              value={editingTiming?.timing_date || newTiming.timing_date}
              onChange={handleTimingChange}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="circuit_id">{t('edit.timings.circuit')}</Label>
            <Select
              value={(editingTiming?.circuit_id || newTiming.circuit_id) || 'none'}
              onValueChange={(v) => {
                const timingRow = editingTiming || newTiming;
                const fn = editingTiming ? setEditingTiming : setNewTiming;
                fn({ ...timingRow, circuit_id: v === 'none' ? '' : v });
              }}
            >
              <SelectTrigger id="circuit_id">
                <SelectValue placeholder={t('edit.timings.selectCircuitOptional')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('edit.none')}</SelectItem>
                {circuits.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{formatCircuitSelectLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supply_voltage_volts">{t('edit.timings.trackVoltage')}</Label>
            <Input
              id="supply_voltage_volts"
              name="supply_voltage_volts"
              value={editingTiming?.supply_voltage_volts ?? newTiming.supply_voltage_volts ?? ''}
              onChange={handleTimingChange}
              placeholder={t('edit.timings.voltagePlaceholder')}
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">{t('edit.timings.voltageTableHint')}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button type="submit">
            {editingTiming ? t('edit.timings.updateRecord') : t('edit.timings.addRecordBtn')}
          </Button>
          {editingTiming && (
            <Button type="button" variant="secondary" onClick={handleCancelEditTiming}>
              {tCommon('actions.cancel')}
            </Button>
          )}
        </div>
      </form>
      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-4">{t('edit.timings.recordsTitle')}</h4>
        {loadingTimings ? (
          <Spinner className="size-6" />
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('edit.timings.tableDate')}</TableHead>
                    <TableHead>{t('edit.timings.tableBestLap')}</TableHead>
                    <TableHead>{t('edit.timings.tableTotalTime')}</TableHead>
                    <TableHead>{t('edit.timings.laps')}</TableHead>
                    <TableHead>{t('edit.timings.tableAverage')}</TableHead>
                    <TableHead>{t('edit.timings.tableDistance')}</TableHead>
                    <TableHead>{t('edit.timings.tableSpeed')}</TableHead>
                    <TableHead>{t('edit.timings.lane')}</TableHead>
                    <TableHead>{t('edit.timings.circuit')}</TableHead>
                    <TableHead className="w-[100px]">V (V)</TableHead>
                    <TableHead className="text-center">{t('edit.timings.tableConfig')}</TableHead>
                    <TableHead>{t('edit.specs.tableActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground">{t('edit.timings.noRecords')}</TableCell>
                    </TableRow>
                  )}
                  {timings.map((timing) => (
                    <TableRow key={timing.id}>
                      <TableCell>
                        {new Date(timing.timing_date).toLocaleDateString()}
                        {getRecordedFromLabel(timing.recorded_from) && timing.recorded_from !== 'web' && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {getRecordedFromLabel(timing.recorded_from)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{timing.best_lap_time}</TableCell>
                      <TableCell className="font-mono">{timing.total_time}</TableCell>
                      <TableCell>{timing.laps}</TableCell>
                      <TableCell className="font-mono">{timing.average_time}</TableCell>
                      <TableCell>
                        {formatDistance(timing.total_distance_meters)}
                      </TableCell>
                      <TableCell>
                        {timing.avg_speed_kmh != null && timing.avg_speed_scale_kmh != null
                          ? t('edit.timings.speedFormat', {
                              real: Number(timing.avg_speed_kmh).toFixed(1),
                              scale: Number(timing.avg_speed_scale_kmh).toFixed(0),
                            })
                          : '-'}
                      </TableCell>
                      <TableCell>{timing.lane || '-'}</TableCell>
                      <TableCell>{timing.circuit || '-'}</TableCell>
                      <TableCell>
                        <Input
                          key={`v-${timing.id}-${timing.supply_voltage_volts ?? ''}`}
                          className="h-8 font-mono text-xs px-2"
                          defaultValue={timing.supply_voltage_volts != null && timing.supply_voltage_volts !== '' ? String(timing.supply_voltage_volts) : ''}
                          placeholder="—"
                          inputMode="decimal"
                          onBlur={(e) => handleTimingVoltageBlur(timing.id, e.target.value)}
                          aria-label={t('edit.timings.voltageAria')}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {timing.setup_snapshot ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTiming(timing);
                              setShowSpecsModal(true);
                            }}
                            title={tTimings('viewSpecs')}
                          >
                            <Wrench className="size-4 mr-1" />
                            Ver Config
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t('edit.timings.noConfig')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {timingHasLaps[timing.id] && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setPerformanceTiming(timing); setShowPerformanceModal(true); }}
                              title={tTimings('viewPerformance')}
                            >
                              <BarChart3 className="size-4" />
                            </Button>
                          )}
                          <Button variant="default" size="sm" onClick={() => handleEditTiming(timing)} title={tCommon('actions.edit')}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteTiming(timing.id)} title={tCommon('actions.delete')}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {timings.length > 0 && (
              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-4">{t('edit.timings.evolutionTitle')}</h4>
                <p className="text-muted-foreground mb-4">
                  Se muestran gráficas de evolución para circuitos y carriles con múltiples registros de tiempo.
                </p>

                {(() => {
                  const groupedTimings = getTimingsByCircuitAndLane();
                  if (groupedTimings.length === 0) {
                    return (
                      <div className="text-center text-muted-foreground py-8">
                        <p>{t('edit.timings.evolutionInsufficient')}</p>
                        <p className="text-sm mt-1">{t('edit.timings.evolutionNeedTwo')}</p>
                      </div>
                    );
                  }

                  return groupedTimings.map((group) => (
                    <React.Fragment key={`${group.circuit}-${group.lane}-${group.laps}`}>
                      <TimingEvolutionChart
                        timings={group.timings}
                        circuit={group.circuit}
                        lane={group.lane}
                        laps={group.laps}
                      />
                      <SpeedEvolutionChart
                        timings={group.timings}
                        circuit={group.circuit}
                        lane={group.lane}
                        laps={group.laps}
                      />
                    </React.Fragment>
                  ));
                })()}
              </div>
            )}

            {timings.filter((row) => row.supply_voltage_volts != null).length >= 2 && (
              <div className="mt-8">
                <VoltagePerformanceChart timings={timings} />
              </div>
            )}

            {trainingGoals.length > 0 && (
              <div className="mt-8">
                <h4 className="text-lg font-semibold mb-4">{t('edit.timings.trainingGoalsTitle')}</h4>
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">{t('edit.timings.goalCircuit')}</th>
                        <th className="p-2">{t('edit.timings.lane')}</th>
                        <th className="p-2">{t('edit.timings.goalType')}</th>
                        <th className="p-2">{t('edit.timings.goalTarget')}</th>
                        <th className="p-2">{t('edit.timings.goalProgress')}</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainingGoals.map((g) => (
                        <tr key={g.id} className="border-b">
                          <td className="p-2">{g.circuits?.name ?? '—'}</td>
                          <td className="p-2">{g.lane ?? '—'}</td>
                          <td className="p-2">{g.goal_type === 'lap_time' ? t('edit.timings.goalLapTime') : t('edit.timings.goalConsistency')}</td>
                          <td className="p-2 font-mono">{Number(g.target_value).toFixed(g.goal_type === 'lap_time' ? 3 : 1)}</td>
                          <td className="p-2">{g.progress?.progressPct ?? 0}%</td>
                          <td className="p-2">
                            {g.active && !g.achieved_at && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await api.patch(`/vehicles/training-goals/${g.id}`, { active: false });
                                  loadTimings();
                                }}
                              >
                                {t('edit.timings.deactivateGoal')}
                              </Button>
                            )}
                            {g.achieved_at && (
                              <span className="text-green-600 text-xs">{t('edit.timings.goalAchieved')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
