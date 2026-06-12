import React from 'react';
import { Trophy, Download, Share2 } from 'lucide-react';
import axios from '../../lib/axios';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

const triggerBlobDownload = (data, filename) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const LeagueStandingsTable = ({
  standings = [],
  competitions = [],
  countingRaces = null,
  exportBasePath = null,
  leagueName = '',
}) => {
  const closedCompetitions = (competitions || []).filter((c) => c.competition_status === 'closed');

  const handleExport = async (type) => {
    if (!exportBasePath) return;
    try {
      const response = await axios.get(`${exportBasePath}/export/${type}`, { responseType: 'blob' });
      const base = (leagueName || 'liga').replace(/[^a-zA-Z0-9]/g, '_');
      const day = new Date().toISOString().split('T')[0];
      const ext = type === 'csv' ? 'csv' : 'pdf';
      triggerBlobDownload(response.data, `liga_${base}_${type === 'social' ? 'social_' : ''}${day}.${ext}`);
      toast.success('Descarga iniciada');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al exportar');
    }
  };

  if (!standings.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Trophy className="size-8 mx-auto mb-3 opacity-50" />
          <p>Aún no hay clasificación. Se calculará cuando las pruebas estén cerradas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Trophy className="size-4" />
            Clasificación general
          </h3>
          {countingRaces ? (
            <p className="text-xs text-muted-foreground mt-1">
              Se descartan las peores pruebas; cuentan las {countingRaces} mejores puntuaciones.
            </p>
          ) : null}
        </div>
        {exportBasePath ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="size-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('social')}>
              <Share2 className="size-4 mr-2" />
              Imagen social
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Pos</TableHead>
              <TableHead>Piloto</TableHead>
              {closedCompetitions.map((comp) => (
                <TableHead key={comp.competition_id} className="text-center min-w-[80px]">
                  <span className="text-xs">{comp.competition_name}</span>
                </TableHead>
              ))}
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((row) => (
              <TableRow key={`${row.name}-${row.email || ''}`}>
                <TableCell>
                  <Badge variant={row.position === 1 ? 'default' : 'outline'}>{row.position}</Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{row.name}</div>
                  {row.email ? (
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  ) : null}
                </TableCell>
                {closedCompetitions.map((comp) => {
                  const entry = row.by_competition?.[comp.competition_id];
                  const pts = entry?.points;
                  const dropped = entry?.dropped;
                  const vehicle = entry?.vehicle;
                  return (
                    <TableCell
                      key={comp.competition_id}
                      className={`text-center align-top ${dropped ? 'text-muted-foreground' : ''}`}
                    >
                      {pts != null ? (
                        <div className="space-y-0.5">
                          <div className={dropped ? 'line-through' : 'font-medium'}>{pts}</div>
                          {(entry?.power_stage_points || 0) > 0 && (
                            <div
                              className={`text-[10px] leading-tight ${
                                dropped ? 'line-through opacity-70' : 'text-muted-foreground'
                              }`}
                            >
                              ⚡ +{entry.power_stage_points} PS
                            </div>
                          )}
                          {vehicle ? (
                            <div
                              className={`text-[10px] leading-tight truncate max-w-[7rem] mx-auto ${
                                dropped ? 'line-through opacity-70' : 'text-muted-foreground'
                              }`}
                              title={vehicle}
                            >
                              {vehicle}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-bold">{row.total_points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default LeagueStandingsTable;
