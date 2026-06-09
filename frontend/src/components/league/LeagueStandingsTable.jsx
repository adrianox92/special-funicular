import React from 'react';
import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';

const LeagueStandingsTable = ({ standings = [], competitions = [] }) => {
  const closedCompetitions = (competitions || []).filter((c) => c.competition_status === 'closed');

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
      <CardHeader>
        <h3 className="font-semibold flex items-center gap-2">
          <Trophy className="size-4" />
          Clasificación general
        </h3>
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
                  const pts = row.by_competition?.[comp.competition_id]?.points;
                  return (
                    <TableCell key={comp.competition_id} className="text-center">
                      {pts != null ? pts : '—'}
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
