import React, { useState, useEffect } from 'react';
import { Trophy, Clock, Car, TrendingUp } from 'lucide-react';
import api from '../lib/axios';
import { Card, CardContent, CardHeader } from './ui/card';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import './LaneComparisonChart.css';

const LaneComparisonChart = () => {
  const [circuits, setCircuits] = useState([]);
  const [selectedCircuit, setSelectedCircuit] = useState('');
  const [laneData, setLaneData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar circuitos únicos
  useEffect(() => {
    const loadCircuits = async () => {
      try {
        const response = await api.get('/timings');
        const uniqueCircuits = [...new Set(response.data
          .filter(t => t.circuit)
          .map(t => t.circuit))];
        setCircuits(uniqueCircuits.sort());
      } catch (err) {
        console.error('Error al cargar circuitos:', err);
      }
    };
    loadCircuits();
  }, []);

  // Cargar datos de carriles cuando se selecciona un circuito
  useEffect(() => {
    if (selectedCircuit) {
      loadLaneData(selectedCircuit);
    }
  }, [selectedCircuit]);

  const loadLaneData = async (circuit) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/timings');
      const circuitTimings = response.data.filter(t => t.circuit === circuit);
      
      // Agrupar por vehículo + vueltas para tener todos los tiempos de cada vehículo
      const vehicleAllTimes = {};
      circuitTimings.forEach(timing => {
        const vehicleKey = `${timing.vehicle_id}-${timing.laps || 'sin-vueltas'}`;
        if (!vehicleAllTimes[vehicleKey]) {
          vehicleAllTimes[vehicleKey] = [];
        }
        vehicleAllTimes[vehicleKey].push(timing);
      });

      // Para cada vehículo, encontrar su mejor tiempo y asignarlo al carril correspondiente
      const lanes = {};
      Object.values(vehicleAllTimes).forEach(vehicleTimings => {
        // Ordenar por mejor tiempo
        const sortedTimings = vehicleTimings.sort((a, b) => 
          getSeconds(a.best_lap_time) - getSeconds(b.best_lap_time)
        );
        
        const bestTiming = sortedTimings[0];
        const lane = bestTiming.lane || 'Sin carril';
        
        if (!lanes[lane]) {
          lanes[lane] = [];
        }
        
        // Añadir el mejor tiempo del vehículo, pero guardar también todos los tiempos para comparativas
        lanes[lane].push({
          ...bestTiming,
          allLaneTimes: sortedTimings // Guardar todos los tiempos para comparativas
        });
      });

      // Procesar cada carril
      const processedLanes = {};
      Object.keys(lanes).forEach(lane => {
        const laneTimings = lanes[lane];
        
        // Ordenar por mejor tiempo
        const sortedVehicles = laneTimings
          .sort((a, b) => getSeconds(a.best_lap_time) - getSeconds(b.best_lap_time));

        processedLanes[lane] = {
          vehicles: sortedVehicles,
          totalVehicles: sortedVehicles.length,
          bestTime: sortedVehicles[0]?.best_lap_time || 'N/A',
          averageTime: calculateAverageTime(sortedVehicles),
          fastestVehicle: sortedVehicles[0]
        };
      });

      setLaneData(processedLanes);
    } catch (err) {
      console.error('Error al cargar datos de carriles:', err);
      setError('Error al cargar los datos de carriles');
    } finally {
      setLoading(false);
    }
  };

  const getSeconds = (timeStr) => {
    if (!timeStr) return Infinity;
    const [minutes, seconds] = timeStr.split(':');
    const [secs, ms] = seconds.split('.');
    return parseInt(minutes) * 60 + parseInt(secs) + parseInt(ms) / 1000;
  };

  const calculateAverageTime = (vehicles) => {
    if (vehicles.length === 0) return 'N/A';
    
    const totalSeconds = vehicles.reduce((sum, v) => sum + getSeconds(v.best_lap_time), 0);
    const avgSeconds = totalSeconds / vehicles.length;
    
    const minutes = Math.floor(avgSeconds / 60);
    const remainingSeconds = (avgSeconds % 60).toFixed(3);
    return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    return timeStr;
  };

  const getLaneBadgeVariant = (lane) => {
    const map = { '1': 'default', '2': 'secondary', '3': 'outline', '4': 'outline', '5': 'destructive', '6': 'secondary', '7': 'secondary', '8': 'secondary' };
    return map[lane] || 'secondary';
  };

  const calculateLaneDifferences = () => {
    if (!selectedCircuit || Object.keys(laneData).length === 0) return null;

    const lanes = Object.keys(laneData).sort();
    if (lanes.length < 2) return null;

    const differences = {};
    
    // Comparar cada carril con el carril 1 (si existe)
    const referenceLane = lanes.find(l => l === '1') || lanes[0];
    const referenceData = laneData[referenceLane];
    
    lanes.forEach(lane => {
      if (lane !== referenceLane) {
        const currentLaneData = laneData[lane];
        const refBestTime = getSeconds(referenceData.bestTime);
        const laneBestTime = getSeconds(currentLaneData.bestTime);
        
        if (refBestTime !== Infinity && laneBestTime !== Infinity) {
          const diff = laneBestTime - refBestTime;
          differences[lane] = {
            difference: diff.toFixed(3),
            percentage: ((diff / refBestTime) * 100).toFixed(1),
            isSlower: diff > 0
          };
        }
      }
    });

    return differences;
  };

  // Función para obtener la diferencia de tiempo del mismo vehículo entre carriles
  const getVehicleLaneDifference = (vehicle, currentLane) => {
    if (!vehicle.allLaneTimes || vehicle.allLaneTimes.length < 2) return null;
    
    // Determinar el carril de referencia (carril 1 si existe, sino el primero disponible)
    const allLanes = Object.keys(laneData).sort();
    const referenceLane = allLanes.find(l => l === '1') || allLanes[0];
    
    // Si solo hay un carril disponible, no hay diferencia
    if (allLanes.length < 2) return null;
    
    // Si estamos en el carril de referencia, buscar el tiempo en otro carril para comparar
    if (currentLane === referenceLane) {
      // Buscar un carril alternativo para comparar
      const alternativeLane = allLanes.find(l => l !== referenceLane);
      if (!alternativeLane) return null;
      
      const alternativeTiming = vehicle.allLaneTimes.find(t => t.lane === alternativeLane);
      if (!alternativeTiming) return null;
      
      const altTime = getSeconds(alternativeTiming.best_lap_time);
      const currentTime = getSeconds(vehicle.best_lap_time);
      
      if (altTime === Infinity || currentTime === Infinity) return null;
      
      const diff = currentTime - altTime;
      return {
        seconds: diff,
        isSlower: diff > 0,
        isFaster: diff < 0,
        referenceTime: alternativeTiming.best_lap_time,
        referenceLane: alternativeLane
      };
    }
    
    // Buscar el tiempo del mismo vehículo en el carril de referencia
    const referenceTiming = vehicle.allLaneTimes.find(t => t.lane === referenceLane);
    
    if (!referenceTiming) return null;
    
    const refTime = getSeconds(referenceTiming.best_lap_time);
    const currentTime = getSeconds(vehicle.best_lap_time);
    
    if (refTime === Infinity || currentTime === Infinity) return null;
    
    const diff = currentTime - refTime;
    return {
      seconds: diff,
      isSlower: diff > 0,
      isFaster: diff < 0,
      referenceTime: referenceTiming.best_lap_time,
      referenceLane: referenceLane
    };
  };

  const getFastestVehiclesByLane = () => {
    if (!selectedCircuit || Object.keys(laneData).length === 0) return null;

    const fastestByLane = {};
    Object.keys(laneData).forEach(lane => {
      const fastest = laneData[lane].vehicles[0];
      if (fastest) {
        fastestByLane[lane] = {
          vehicle: `${fastest.vehicle_manufacturer} ${fastest.vehicle_model}`,
          time: fastest.best_lap_time,
          seconds: getSeconds(fastest.best_lap_time)
        };
      }
    });

    return fastestByLane;
  };

  const laneDifferences = calculateLaneDifferences();
  const fastestByLane = getFastestVehiclesByLane();

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center">
        <TrendingUp className="size-4 mr-2" />
        <h6 className="font-semibold">Comparativa de Carriles</h6>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <Label className="font-bold">Seleccionar Circuito</Label>
          <Select value={selectedCircuit || '__none__'} onValueChange={(v) => setSelectedCircuit(v === '__none__' ? '' : v)}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecciona un circuito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Selecciona un circuito</SelectItem>
              {circuits.map(circuit => (
                <SelectItem key={circuit} value={circuit}>{circuit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            <strong>Nota:</strong> Cada vehículo aparece solo en el carril donde hizo su mejor tiempo.
            <br />
            <strong>Comparativa:</strong> La diferencia muestra cuánto más rápido/lento es el mismo vehículo en este carril vs otro carril disponible.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <Spinner className="size-8" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription><strong>Error</strong><br />{error}</AlertDescription>
          </Alert>
        )}

        {selectedCircuit && !loading && Object.keys(laneData).length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {Object.keys(laneData).map(lane => (
                <Card key={lane} className="text-center">
                  <CardContent className="pt-6">
                    <Badge variant={getLaneBadgeVariant(lane)} className="mb-3">Carril {lane}</Badge>
                    <div className="text-2xl font-bold text-primary">{laneData[lane].totalVehicles}</div>
                    <small className="text-muted-foreground block mb-3">Vehículos</small>
                    <div className="font-mono font-medium">{formatTime(laneData[lane].bestTime)}</div>
                    <small className="text-muted-foreground">Mejor tiempo</small>
                    <div className="text-sm text-muted-foreground mt-1">Promedio: {laneData[lane].averageTime}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mb-6">
              <h6 className="font-semibold flex items-center gap-2 mb-2">
                <Clock className="size-4" />
                Comparativa con Carril de Referencia
              </h6>
              <p className="text-sm text-muted-foreground mb-3">
                <strong>Carril de Referencia:</strong> Se usa como base para comparar. El carril 1 es la referencia si existe.
              </p>
              {Object.keys(laneData).length < 2 ? (
                <Alert className="text-center">
                  <AlertDescription><strong>Información:</strong> Solo hay un carril disponible, no es posible comparar.</AlertDescription>
                </Alert>
              ) : laneDifferences && Object.keys(laneDifferences).length > 0 ? (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Carril</TableHead>
                        <TableHead>Diferencia</TableHead>
                        <TableHead>Porcentaje</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(laneDifferences).map(lane => {
                        const diff = laneDifferences[lane];
                        const lanes = Object.keys(laneData).sort();
                        const referenceLane = lanes.find(l => l === '1') || lanes[0];
                        return (
                          <TableRow key={lane}>
                            <TableCell><Badge variant={getLaneBadgeVariant(lane)}>Carril {lane}</Badge></TableCell>
                            <TableCell className="font-mono font-medium">
                              <span className={diff.isSlower ? 'text-destructive' : 'text-green-600'}>{diff.isSlower ? '+' : ''}{diff.difference}s</span>
                              <div className="text-xs text-muted-foreground">vs Carril {referenceLane}</div>
                            </TableCell>
                            <TableCell>
                              <span className={diff.isSlower ? 'text-amber-600' : 'text-green-600'}>{diff.isSlower ? '+' : ''}{diff.percentage}%</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={diff.isSlower ? 'secondary' : 'default'} className="flex items-center gap-1 w-fit">
                                {diff.isSlower ? <><Clock className="size-3" /> Más lento</> : <><Trophy className="size-3" /> Más rápido</>}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Alert variant="destructive" className="text-center">
                  <AlertDescription><strong>Atención:</strong> No se pueden calcular diferencias con los datos disponibles.</AlertDescription>
                </Alert>
              )}
            </div>

            {fastestByLane && (
              <div className="mb-6">
                <h6 className="font-semibold flex items-center gap-2 mb-4">
                  <Car className="size-4" />
                  Vehículos Más Rápidos por Carril
                </h6>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.keys(fastestByLane).map(lane => {
                    const fastest = fastestByLane[lane];
                    return (
                      <Card key={lane} className="text-center">
                        <CardContent className="pt-6">
                          <Badge variant={getLaneBadgeVariant(lane)} className="mb-3">Carril {lane}</Badge>
                          <div className="font-semibold text-primary mb-2">{fastest.vehicle}</div>
                          <div className="font-mono font-medium mb-2">{fastest.time}</div>
                          <small className="text-muted-foreground">Mejor tiempo</small>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h6 className="font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="size-4" />
                Ranking Detallado por Carril
              </h6>
              {Object.keys(laneData).map(lane => (
                <div key={lane} className="mb-6">
                  <h6 className="mb-3 flex items-center gap-2">
                    <Badge variant={getLaneBadgeVariant(lane)}>Carril {lane}</Badge>
                    <span className="font-medium text-muted-foreground">({laneData[lane].totalVehicles} vehículos)</span>
                  </h6>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pos</TableHead>
                          <TableHead>Vehículo</TableHead>
                          <TableHead>Mejor Vuelta</TableHead>
                          <TableHead>Diferencia</TableHead>
                          <TableHead>Vueltas</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {laneData[lane].vehicles.map((vehicle, index) => {
                          const timeDifference = getVehicleLaneDifference(vehicle, lane);
                          return (
                            <TableRow key={`${lane}-${vehicle.id}`}>
                              <TableCell>
                                <Badge variant={index === 0 ? 'default' : 'secondary'} className="flex items-center gap-1 w-fit">
                                  {index === 0 && <Trophy className="size-3" />}
                                  {index + 1}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{vehicle.vehicle_manufacturer} {vehicle.vehicle_model}</TableCell>
                              <TableCell className="font-mono">{vehicle.best_lap_time}</TableCell>
                              <TableCell>
                                {timeDifference ? (
                                  <div className="flex items-center gap-2">
                                    <span className={`font-medium ${timeDifference.isFaster ? 'text-green-600' : timeDifference.isSlower ? 'text-destructive' : 'text-muted-foreground'}`}>
                                      {timeDifference.isFaster ? '-' : timeDifference.isSlower ? '+' : ''}{Math.abs(timeDifference.seconds).toFixed(3)}s
                                    </span>
                                    <small className="text-muted-foreground">vs Carril {timeDifference.referenceLane}</small>
                                  </div>
                                ) : Object.keys(laneData).length < 2 ? (
                                  <span className="text-muted-foreground italic">Único carril disponible</span>
                                ) : (
                                  <span className="text-muted-foreground italic">Sin comparativa</span>
                                )}
                              </TableCell>
                              <TableCell><Badge variant="secondary">{vehicle.laps || 'N/A'}</Badge></TableCell>
                              <TableCell>{new Date(vehicle.timing_date).toLocaleDateString()}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedCircuit && !loading && Object.keys(laneData).length === 0 && (
          <Alert className="text-center">
            <AlertDescription>
              <strong>Sin Datos</strong><br />
              No hay datos de tiempos registrados para el circuito <strong>{selectedCircuit}</strong>.
              <br />
              <small className="text-muted-foreground">Intenta seleccionar otro circuito o registra algunos tiempos primero.</small>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default LaneComparisonChart;
