import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, Row, Col } from 'react-bootstrap';

const TimingEvolutionChart = ({ timings, circuit, lane, laps }) => {
  // Filtrar tiempos por circuito y carril
  const filteredTimings = timings.filter(timing => 
    timing.circuit === circuit && timing.lane === lane
  );

  // Si no hay suficientes tiempos para mostrar evolución, no mostrar la gráfica
  if (filteredTimings.length < 2) {
    return null;
  }

  // Función para convertir tiempo de formato mm:ss.ms a segundos
  const convertTimeToSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/^(\d{2}):(\d{2})\.(\d{3})$/);
    if (!match) return 0;
    const [, minutes, seconds, milliseconds] = match.map(Number);
    return minutes * 60 + seconds + milliseconds / 1000;
  };

  // Función para formatear diferencia de tiempo
  const formatTimeDifference = (current, previous) => {
    if (previous === 0) return 'Primera sesión';
    
    const difference = current - previous;
    const absDifference = Math.abs(difference);
    
    if (difference === 0) return 'Sin cambios';
    
    const minutes = Math.floor(absDifference / 60);
    const seconds = Math.floor(absDifference % 60);
    const milliseconds = Math.floor((absDifference % 1) * 1000);
    
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    
    return difference < 0 ? `🔽 Mejoró ${timeStr}` : `🔼 Empeoró ${timeStr}`;
  };

  // Ordenar por fecha y preparar datos para la gráfica
  const chartData = filteredTimings
    .sort((a, b) => new Date(a.timing_date) - new Date(b.timing_date))
    .map((timing, index) => {
      // Convertir tiempos a segundos para la gráfica
      const bestLapSeconds = convertTimeToSeconds(timing.best_lap_time);
      const totalTimeSeconds = convertTimeToSeconds(timing.total_time);
      
      // Obtener tiempos anteriores para calcular diferencias
      const previousBestLap = index > 0 ? convertTimeToSeconds(filteredTimings[index - 1].best_lap_time) : 0;
      const previousTotalTime = index > 0 ? convertTimeToSeconds(filteredTimings[index - 1].total_time) : 0;
      
      return {
        date: new Date(timing.timing_date).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit'
        }),
        bestLap: bestLapSeconds,
        totalTime: totalTimeSeconds,
        laps: timing.laps,
        bestLapDifference: formatTimeDifference(bestLapSeconds, previousBestLap),
        totalTimeDifference: formatTimeDifference(totalTimeSeconds, previousTotalTime),
        originalData: timing
      };
    });

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '00:00.000';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(3);
    return `${String(minutes).padStart(2, '0')}:${remainingSeconds.padStart(6, '0')}`;
  };

  const CustomTooltip = ({ active, payload, label, type }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isBestLap = type === 'bestLap';
      
      return (
        <div className="custom-tooltip p-3 bg-white border rounded shadow-sm">
          <p className="mb-2 fw-bold">Fecha: {label}</p>
          <p className="mb-1">
            {isBestLap ? 'Mejor vuelta' : 'Tiempo total'}: {formatTime(payload[0].value)}
          </p>
          <p className="mb-1">Vueltas: {data.laps}</p>
          <p className={`mb-1 ${isBestLap ? 'text-primary' : 'text-success'}`}>
            <strong>Evolución:</strong> {isBestLap ? data.bestLapDifference : data.totalTimeDifference}
          </p>
          <p className="mb-0 small text-muted">
            {data.originalData.circuit} - Carril {data.originalData.lane}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-4 shadow-sm">
      <Card.Body>
        <Card.Title className="mb-3">
          Evolución de Tiempos - {circuit} (Carril {lane}) - {laps} vueltas
        </Card.Title>
        
        <Row>
          {/* Gráfica de Mejor Vuelta */}
          <Col md={6}>
            <h6 className="text-center mb-3">Evolución de Mejor Vuelta</h6>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis 
                    dataKey="date" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    tickFormatter={formatTime}
                    domain={['dataMin - 0.5', 'dataMax + 0.5']}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip type="bestLap" />} />
                  <Line 
                    type="monotone" 
                    dataKey="bestLap" 
                    stroke="#8884d8" 
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                    name="Mejor Vuelta"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Col>

          {/* Gráfica de Tiempo Total */}
          <Col md={6}>
            <h6 className="text-center mb-3">Evolución de Tiempo Total</h6>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis 
                    dataKey="date" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    tickFormatter={formatTime}
                    domain={['dataMin - 2', 'dataMax + 2']}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip type="totalTime" />} />
                  <Line 
                    type="monotone" 
                    dataKey="totalTime" 
                    stroke="#82ca9d" 
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                    name="Tiempo Total"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Col>
        </Row>

        <div className="mt-4">
          <small className="text-muted">
            Se muestran {filteredTimings.length} registros de tiempo para {circuit}, carril {lane}, con {laps} vueltas.
            {filteredTimings.length >= 3 && ' Cada gráfica muestra la evolución independiente de cada métrica con su propia escala.'}
            <br />
            <span className="text-primary">🔽</span> Mejoró, <span className="text-danger">🔼</span> Empeoró, <span className="text-muted">➡️</span> Sin cambios
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TimingEvolutionChart;
