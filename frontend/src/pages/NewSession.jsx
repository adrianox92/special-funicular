import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Car, Check, ChevronDown, Flag, Plus, Search, Timer } from 'lucide-react';
import api from '../lib/axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';
import { TimeInput, TimeInputHint } from '../components/ui/TimeInput';
import { cn } from '../lib/utils';
import { SESSION_EVENTS, trackSessionEvent } from '../lib/analytics';
import { formatLapTimeDisplay } from '../utils/formatUtils';
import {
  buildSessionTimingPayload,
  calculateAverageTime,
  formatSecondsToLapTime,
  getTotalTimeTooLowContext,
} from '../utils/averageLapTime';
import { getLastSessionCircuitId, pickDefaultCircuitId, setLastSessionCircuitId } from '../utils/sessionLastCircuit';
import {
  getLastSessionVehicleId,
  pickDefaultVehicleId,
  setLastSessionVehicleId,
} from '../utils/sessionLastVehicle';
import {
  getSessionCaptureIssue,
  isBlockingCaptureIssue,
} from '../utils/sessionCaptureValidation';

const VEHICLES_PAGE_LIMIT = 10000;
const STEPS = ['circuit', 'vehicle', 'capture', 'summary'];

function vehicleLabel(vehicle) {
  if (!vehicle) return '';
  const base = `${vehicle.manufacturer ?? ''} ${vehicle.model ?? ''}`.trim();
  return base || String(vehicle.id);
}

function clubName(circuit) {
  const nested = circuit?.clubs;
  if (!nested) return null;
  if (typeof nested === 'string') return nested;
  return nested.name || null;
}

function formatDeltaAbs(seconds) {
  const abs = Math.abs(Number(seconds));
  if (!Number.isFinite(abs)) return '';
  return formatSecondsToLapTime(abs);
}

const emptyCapture = () => ({
  bestLapTime: '',
  totalTime: '',
  laps: '',
  lane: '',
  supplyVoltageVolts: '',
});

function CircuitCreateForm({
  t,
  createName,
  setCreateName,
  createLanes,
  setCreateLanes,
  creatingCircuit,
  createError,
  onSubmit,
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {createError ? (
        <Alert variant="destructive">
          <AlertDescription>{createError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="session-circuit-name">{t('circuit.name')}</Label>
        <Input
          id="session-circuit-name"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder={t('circuit.namePlaceholder')}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="session-circuit-lanes">{t('circuit.numLanes')}</Label>
        <Input
          id="session-circuit-lanes"
          type="number"
          min="1"
          max="8"
          value={createLanes}
          onChange={(e) => setCreateLanes(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={creatingCircuit}>
        <Plus className="size-4 mr-2" aria-hidden />
        {creatingCircuit ? t('circuit.creating') : t('circuit.create')}
      </Button>
    </form>
  );
}

const NewSession = () => {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState('circuit');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [circuits, setCircuits] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [circuitId, setCircuitId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const [createName, setCreateName] = useState('');
  const [createLanes, setCreateLanes] = useState('2');
  const [creatingCircuit, setCreatingCircuit] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [capture, setCapture] = useState(emptyCapture);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [lastUsedId, setLastUsedId] = useState(() => getLastSessionCircuitId());
  const [lastUsedVehicleId, setLastUsedVehicleId] = useState(() => getLastSessionVehicleId());
  const [invalidField, setInvalidField] = useState(null);

  const bestLapRef = useRef(null);
  const totalTimeRef = useRef(null);
  const lapsRef = useRef(null);
  const voltageRef = useRef(null);
  const focusBestOnCaptureRef = useRef(false);

  const visitRef = useRef({
    opened: false,
    saved: false,
    abandoned: false,
    circuitCreated: false,
    hasPriorCircuit: false,
  });
  const stepRef = useRef(step);
  const captureRef = useRef(capture);
  stepRef.current = step;
  captureRef.current = capture;

  const funnelFromVisit = (overrides = {}) => {
    const cap = captureRef.current || {};
    return {
      step: stepRef.current,
      hasPriorCircuit: visitRef.current.hasPriorCircuit,
      circuitCreated: visitRef.current.circuitCreated,
      laneSet: Boolean(cap.lane),
      voltageSet: Boolean(String(cap.supplyVoltageVolts || '').trim()),
      ...overrides,
    };
  };

  const trackAbandonedIfNeeded = useCallback(() => {
    const visit = visitRef.current;
    if (visit.saved || visit.abandoned || !visit.opened) return;
    visit.abandoned = true;
    trackSessionEvent(SESSION_EVENTS.ABANDONED, funnelFromVisit());
  }, []);

  const selectedCircuit = useMemo(
    () => circuits.find((c) => String(c.id) === String(circuitId)) || null,
    [circuits, circuitId],
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(vehicleId)) || null,
    [vehicles, vehicleId],
  );

  const showLane = Number(selectedCircuit?.num_lanes) > 1;
  const laneCount = Math.max(1, parseInt(String(selectedCircuit?.num_lanes || 1), 10) || 1);

  const averageTime = calculateAverageTime(capture.totalTime, capture.laps, capture.bestLapTime);
  const totalTooLow = getTotalTimeTooLowContext(capture.totalTime, capture.laps, capture.bestLapTime);

  const filteredVehicles = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const haystack = [v.manufacturer, v.model, v.type, v.traction].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [vehicles, vehicleSearch]);

  const queryCircuitId = searchParams.get('circuit_id');
  const queryVehicleId = searchParams.get('vehicle_id');

  const loadLists = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [circuitsRes, vehiclesRes] = await Promise.all([
        api.get('/circuits'),
        api.get('/vehicles', { params: { page: 1, limit: VEHICLES_PAGE_LIMIT } }),
      ]);
      const circuitList = Array.isArray(circuitsRes.data) ? circuitsRes.data : [];
      const vehicleList = Array.isArray(vehiclesRes.data?.vehicles) ? vehiclesRes.data.vehicles : [];
      setCircuits(circuitList);
      setVehicles(vehicleList);

      const rememberedVehicleId = getLastSessionVehicleId();
      const nextCircuitId = pickDefaultCircuitId(circuitList, queryCircuitId);
      const nextVehicleId = pickDefaultVehicleId(vehicleList, queryVehicleId);
      setCircuitId(nextCircuitId);
      setVehicleId(nextVehicleId);
      setLastUsedVehicleId(getLastSessionVehicleId());

      const visit = visitRef.current;
      visit.hasPriorCircuit = circuitList.length > 0;
      const vehicleFromMemoryOrQuery = Boolean(
        (queryVehicleId && nextVehicleId && String(nextVehicleId) === String(queryVehicleId))
        || (rememberedVehicleId && nextVehicleId && String(nextVehicleId) === String(rememberedVehicleId)),
      );
      let landingStep = 'circuit';
      if (nextCircuitId && nextVehicleId && vehicleFromMemoryOrQuery) {
        landingStep = 'capture';
        setStep('capture');
      } else if (nextCircuitId && queryVehicleId) {
        landingStep = 'vehicle';
        setStep('vehicle');
      }
      if (!visit.opened) {
        visit.opened = true;
        trackSessionEvent(SESSION_EVENTS.MODE_OPENED, funnelFromVisit({
          step: landingStep,
          laneSet: false,
          voltageSet: false,
        }));
        if (nextCircuitId && queryCircuitId && String(nextCircuitId) === String(queryCircuitId)) {
          trackSessionEvent(SESSION_EVENTS.CIRCUIT_SELECTED, funnelFromVisit({
            step: 'circuit',
            laneSet: false,
            voltageSet: false,
          }));
        }
        if (nextVehicleId && queryVehicleId) {
          trackSessionEvent(SESSION_EVENTS.VEHICLE_SELECTED, funnelFromVisit({
            step: 'vehicle',
            laneSet: false,
            voltageSet: false,
          }));
        }
      }
    } catch (err) {
      const visit = visitRef.current;
      if (!visit.opened) {
        visit.opened = true;
        trackSessionEvent(SESSION_EVENTS.MODE_OPENED, funnelFromVisit({
          step: 'circuit',
          hasPriorCircuit: false,
          laneSet: false,
          voltageSet: false,
        }));
      }
      setLoadError(err.response?.data?.error || err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [queryCircuitId, queryVehicleId]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    const onLeave = () => trackAbandonedIfNeeded();
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
      onLeave();
    };
  }, [trackAbandonedIfNeeded]);

  useEffect(() => {
    if (step !== 'capture' || !focusBestOnCaptureRef.current) return;
    focusBestOnCaptureRef.current = false;
    window.requestAnimationFrame(() => bestLapRef.current?.focus());
  }, [step]);

  const handleCreateCircuit = async (e) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name) {
      setCreateError(t('circuit.nameRequired'));
      return;
    }
    setCreatingCircuit(true);
    setCreateError(null);
    try {
      const numLanes = Math.max(1, parseInt(createLanes, 10) || 1);
      const { data } = await api.post('/circuits', {
        name,
        num_lanes: numLanes,
        lane_lengths: Array(numLanes).fill(0),
      });
      const created = data?.id ? data : data?.circuit;
      if (!created?.id) {
        throw new Error(t('circuit.createError'));
      }
      setCircuits((prev) => {
        const next = [...prev.filter((c) => c.id !== created.id), created];
        next.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
        return next;
      });
      setCircuitId(String(created.id));
      setLastSessionCircuitId(created.id);
      setLastUsedId(String(created.id));
      setCreateName('');
      visitRef.current.circuitCreated = true;
      trackSessionEvent(SESSION_EVENTS.CIRCUIT_CREATED, funnelFromVisit({
        step: 'circuit',
        circuitCreated: true,
        laneSet: false,
        voltageSet: false,
      }));
      setStep('vehicle');
    } catch (err) {
      setCreateError(err.response?.data?.error || t('circuit.createError'));
    } finally {
      setCreatingCircuit(false);
    }
  };

  const handleContinueFromCircuit = () => {
    if (!circuitId) return;
    setLastSessionCircuitId(circuitId);
    setLastUsedId(String(circuitId));
    trackSessionEvent(SESSION_EVENTS.CIRCUIT_SELECTED, funnelFromVisit({
      step: 'circuit',
      laneSet: false,
      voltageSet: false,
    }));
    setStep('vehicle');
  };

  const rememberVehicle = (id) => {
    if (!id) return;
    setLastSessionVehicleId(id);
    setLastUsedVehicleId(String(id));
  };

  const focusCaptureField = (field) => {
    const refs = {
      bestLapTime: bestLapRef,
      totalTime: totalTimeRef,
      laps: lapsRef,
      supplyVoltageVolts: voltageRef,
    };
    const node = refs[field]?.current;
    if (!node || typeof node.focus !== 'function') return;
    window.requestAnimationFrame(() => node.focus());
  };

  const handleContinueFromVehicle = () => {
    if (!vehicleId) return;
    rememberVehicle(vehicleId);
    trackSessionEvent(SESSION_EVENTS.VEHICLE_SELECTED, funnelFromVisit({
      step: 'vehicle',
      laneSet: false,
      voltageSet: false,
    }));
    setStep('capture');
  };

  const handleCaptureField = (name, value) => {
    setCapture((prev) => ({ ...prev, [name]: value }));
    setSaveError(null);
    setInvalidField((current) => (current === name ? null : current));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const issue = getSessionCaptureIssue(capture);
    if (isBlockingCaptureIssue(issue)) {
      if (issue.openMore) setShowMore(true);
      setInvalidField(issue.field);
      const message = issue.params
        ? t(`capture.${issue.code}`, issue.params)
        : t(`capture.${issue.code}`);
      setSaveError(message);
      window.setTimeout(() => focusCaptureField(issue.field), issue.openMore ? 50 : 0);
      return;
    }

    const voltageRaw = String(capture.supplyVoltageVolts || '').trim();

    setSaving(true);
    setSaveError(null);
    setInvalidField(null);
    try {
      const payload = buildSessionTimingPayload({
        vehicleId,
        circuitId: selectedCircuit?.id,
        circuitName: selectedCircuit?.name,
        lane: showLane ? capture.lane : '',
        bestLapTime: capture.bestLapTime,
        totalTime: capture.totalTime,
        laps: capture.laps,
        supplyVoltageVolts: voltageRaw,
      });
      const { data } = await api.post('/timings', payload);
      visitRef.current.saved = true;
      trackSessionEvent(SESSION_EVENTS.TIMING_SAVED, funnelFromVisit({
        step: 'capture',
        laneSet: Boolean(payload.lane),
        voltageSet: Boolean(voltageRaw),
      }));
      setLastSessionCircuitId(circuitId);
      setLastUsedId(String(circuitId));
      rememberVehicle(vehicleId);
      setSummary({
        timing: data,
        vehicle: selectedVehicle,
        circuit: selectedCircuit,
        lane: payload.lane || '',
        bestLap: payload.best_lap_time,
        syncMeta: data?.sync_meta || {},
      });
      setStep('summary');
    } catch (err) {
      setSaveError(err.response?.data?.error || t('capture.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleAnotherLap = () => {
    setCapture((prev) => ({
      ...emptyCapture(),
      lane: prev.lane,
      supplyVoltageVolts: prev.supplyVoltageVolts,
    }));
    setSaveError(null);
    setInvalidField(null);
    setSummary(null);
    focusBestOnCaptureRef.current = true;
    setStep('capture');
  };

  const handleChangeCar = () => {
    setCapture(emptyCapture());
    setShowMore(false);
    setSaveError(null);
    setInvalidField(null);
    setSummary(null);
    setVehicleSearch('');
    setStep('vehicle');
  };

  const handleCancel = () => {
    trackAbandonedIfNeeded();
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Spinner className="size-8" />
        <span className="sr-only">{tCommon('loading')}</span>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Timer className="size-6 shrink-0" aria-hidden />
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {step !== 'summary' ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            {t('cancel')}
          </Button>
        ) : null}
      </div>

      <ol className="flex gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground" aria-label={t('title')}>
        {STEPS.map((id, idx) => (
          <li
            key={id}
            className={cn(
              'flex-1 truncate rounded-md px-2 py-1.5 text-center',
              idx === stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted',
              idx < stepIndex && 'bg-primary/15 text-foreground',
            )}
          >
            {t(`steps.${id}`)}
          </li>
        ))}
      </ol>

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{loadError}</span>
            <Button type="button" variant="outline" size="sm" onClick={loadLists}>
              {tCommon('actions.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {step === 'circuit' ? (
        <section className="space-y-4" data-testid="session-step-circuit">
          <h2 className="text-lg font-semibold">{t('circuit.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('circuit.hint')}</p>

          {circuits.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="space-y-3 py-6">
                <p className="font-medium">{t('circuit.emptyTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('circuit.emptyHint')}</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2" role="listbox" aria-label={t('steps.circuit')}>
              {circuits.map((circuit) => {
                const selected = String(circuit.id) === String(circuitId);
                const club = clubName(circuit);
                const isLast = String(circuit.id) === String(lastUsedId);
                return (
                  <li key={circuit.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent/50',
                      )}
                      onClick={() => setCircuitId(String(circuit.id))}
                    >
                      <Flag className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{circuit.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {Number(circuit.num_lanes) > 1
                            ? t('capture.lane') + ` · ${circuit.num_lanes}`
                            : null}
                          {club ? t('circuit.club', { name: club }) : null}
                          {isLast ? <Badge variant="secondary">{t('circuit.lastUsed')}</Badge> : null}
                        </span>
                      </span>
                      {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {circuits.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
              <p className="text-sm font-medium">{t('circuit.createTitle')}</p>
              <CircuitCreateForm
                t={t}
                createName={createName}
                setCreateName={setCreateName}
                createLanes={createLanes}
                setCreateLanes={setCreateLanes}
                creatingCircuit={creatingCircuit}
                createError={createError}
                onSubmit={handleCreateCircuit}
              />
            </div>
          ) : (
            <details className="rounded-lg border border-border bg-muted/20 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{t('circuit.createTitle')}</summary>
              <div className="mt-3">
                <CircuitCreateForm
                  t={t}
                  createName={createName}
                  setCreateName={setCreateName}
                  createLanes={createLanes}
                  setCreateLanes={setCreateLanes}
                  creatingCircuit={creatingCircuit}
                  createError={createError}
                  onSubmit={handleCreateCircuit}
                />
              </div>
            </details>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={handleContinueFromCircuit} disabled={!circuitId} data-testid="session-continue-circuit">
              {t('continue')}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'vehicle' ? (
        <section className="space-y-4" data-testid="session-step-vehicle">
          <h2 className="text-lg font-semibold">{t('vehicle.title')}</h2>
          {vehicles.length > 0 ? (
            <p className="text-sm text-muted-foreground">{t('vehicle.hint')}</p>
          ) : null}

          {vehicles.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="space-y-4 py-6">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Car className="size-6 text-muted-foreground" aria-hidden />
                </div>
                <p className="font-medium">{t('vehicle.emptyTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('vehicle.emptyHint')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/vehicles/new">{t('vehicle.addVehicle')}</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/catalogo">{t('vehicle.catalog')}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder={t('vehicle.searchPlaceholder')}
                  className="pl-9"
                  aria-label={t('vehicle.searchPlaceholder')}
                />
              </div>
              {filteredVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('vehicle.noMatches')}</p>
              ) : (
                <ul className="max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto" role="listbox" aria-label={t('steps.vehicle')}>
                  {filteredVehicles.map((vehicle) => {
                    const selected = String(vehicle.id) === String(vehicleId);
                    const isLast = String(vehicle.id) === String(lastUsedVehicleId);
                    return (
                      <li key={vehicle.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-accent/50',
                          )}
                          onClick={() => setVehicleId(String(vehicle.id))}
                        >
                          {vehicle.image ? (
                            <img
                              src={vehicle.image}
                              alt=""
                              className="size-10 rounded object-cover bg-muted"
                            />
                          ) : (
                            <span className="flex size-10 items-center justify-center rounded bg-muted">
                              <Car className="size-4 text-muted-foreground" aria-hidden />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium truncate">{vehicleLabel(vehicle)}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              {vehicle.type ? <span>{vehicle.type}</span> : null}
                              {isLast ? <Badge variant="secondary">{t('vehicle.lastUsed')}</Badge> : null}
                            </span>
                          </span>
                          {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep('circuit')}>
              {t('back')}
            </Button>
            <Button type="button" onClick={handleContinueFromVehicle} disabled={!vehicleId} data-testid="session-continue-vehicle">
              {t('continue')}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'capture' ? (
        <section className="space-y-4" data-testid="session-step-capture">
          <div>
            <h2 className="text-lg font-semibold">{t('capture.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('capture.subtitle', {
                vehicle: vehicleLabel(selectedVehicle),
                circuit: selectedCircuit?.name || '',
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('capture.todayHint')}</p>
          </div>

          <form className="space-y-4" onSubmit={handleSave} noValidate>
            <TimeInputHint className="mb-1" />
            <div className="space-y-2">
              <Label htmlFor="session-best-lap">{t('capture.bestLap')}</Label>
              <TimeInput
                id="session-best-lap"
                ref={bestLapRef}
                value={capture.bestLapTime}
                onChange={(val) => handleCaptureField('bestLapTime', val)}
                aria-invalid={invalidField === 'bestLapTime'}
                aria-describedby={invalidField === 'bestLapTime' && saveError ? 'session-capture-error' : undefined}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-total-time">{t('capture.totalTime')}</Label>
              <TimeInput
                id="session-total-time"
                ref={totalTimeRef}
                value={capture.totalTime}
                onChange={(val) => handleCaptureField('totalTime', val)}
                aria-invalid={invalidField === 'totalTime'}
                aria-describedby={invalidField === 'totalTime' && saveError ? 'session-capture-error' : undefined}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-laps">{t('capture.laps')}</Label>
              <Input
                id="session-laps"
                ref={lapsRef}
                type="number"
                min="1"
                inputMode="numeric"
                value={capture.laps}
                onChange={(e) => handleCaptureField('laps', e.target.value)}
                aria-invalid={invalidField === 'laps'}
                aria-describedby={invalidField === 'laps' && saveError ? 'session-capture-error' : undefined}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-average">{t('capture.average')}</Label>
              <Input id="session-average" value={averageTime} readOnly className="font-mono bg-muted/40" />
            </div>

            {showLane ? (
              <div className="space-y-2">
                <Label htmlFor="session-lane">{t('capture.lane')}</Label>
                <select
                  id="session-lane"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={capture.lane}
                  onChange={(e) => handleCaptureField('lane', e.target.value)}
                >
                  <option value="">{t('capture.laneNone')}</option>
                  {Array.from({ length: laneCount }, (_, i) => String(i + 1)).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {totalTooLow ? (
              <Alert>
                <AlertDescription>
                  {t('capture.totalTooLow', totalTooLow)}
                </AlertDescription>
              </Alert>
            ) : null}

            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                aria-expanded={showMore}
                onClick={() => setShowMore((v) => !v)}
              >
                <ChevronDown className={cn('size-4 mr-1 transition-transform', showMore && 'rotate-180')} aria-hidden />
                {t('capture.moreDetails')}
              </Button>
              {showMore ? (
                <div className="mt-2 space-y-2">
                  <Label htmlFor="session-voltage">{t('capture.voltage')}</Label>
                  <Input
                    id="session-voltage"
                    ref={voltageRef}
                    inputMode="decimal"
                    placeholder={t('capture.voltagePlaceholder')}
                    value={capture.supplyVoltageVolts}
                    onChange={(e) => handleCaptureField('supplyVoltageVolts', e.target.value)}
                    aria-invalid={invalidField === 'supplyVoltageVolts'}
                    aria-describedby={invalidField === 'supplyVoltageVolts' && saveError ? 'session-capture-error' : undefined}
                  />
                </div>
              ) : null}
            </div>

            {saveError ? (
              <Alert variant="destructive">
                <AlertDescription id="session-capture-error">{saveError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('vehicle')}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={saving} data-testid="session-save">
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'summary' && summary ? (
        <section className="space-y-4" data-testid="session-step-summary">
          <h2 className="text-lg font-semibold">{t('summary.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('summary.saved')}</p>
          <Card>
            <CardContent className="space-y-3 py-5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('summary.vehicle')}</span>
                <span className="font-medium text-right">{vehicleLabel(summary.vehicle)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('summary.circuit')}</span>
                <span className="font-medium text-right">{summary.circuit?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('capture.lane')}</span>
                <span className="font-medium text-right">
                  {summary.lane ? t('summary.lane', { lane: summary.lane }) : t('summary.noLane')}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('summary.bestLap')}</span>
                <span className="font-mono font-medium">{summary.bestLap}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('summary.previousBest')}</span>
                <span className="font-mono font-medium text-right">
                  {summary.syncMeta?.previous_best_lap_seconds != null
                    ? formatLapTimeDisplay(summary.syncMeta.previous_best_lap_seconds)
                    : t('summary.noPrevious')}
                </span>
              </div>
              {summary.syncMeta?.is_personal_best ? (
                <Badge>{t('summary.personalBest')}</Badge>
              ) : null}
              {summary.syncMeta?.delta_vs_pb_seconds != null && Number.isFinite(Number(summary.syncMeta.delta_vs_pb_seconds)) ? (
                <p className="text-xs text-muted-foreground">
                  {Number(summary.syncMeta.delta_vs_pb_seconds) <= 0
                    ? t('summary.deltaFaster', { time: formatDeltaAbs(summary.syncMeta.delta_vs_pb_seconds) })
                    : t('summary.deltaSlower', { time: formatDeltaAbs(summary.syncMeta.delta_vs_pb_seconds) })}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t('summary.anotherHint')}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" onClick={handleAnotherLap} data-testid="session-another">
                {t('summary.another')}
              </Button>
              <Button type="button" variant="outline" onClick={handleChangeCar} data-testid="session-change-car">
                {t('summary.changeCar')}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" asChild>
                <Link to={`/vehicles/${summary.vehicle?.id}`}>{t('summary.viewVehicle')}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/timings">{t('summary.viewTimings')}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default NewSession;
