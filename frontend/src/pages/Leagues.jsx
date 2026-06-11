import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trophy, Link2, BarChart3 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';
import LeagueStatusBadge from '../components/league/LeagueStatusBadge';
import { toast } from 'sonner';

const SCORING_LABEL = {
  league_rules: 'Reglas de liga',
  per_competition: 'Reglas por prueba',
};

const Leagues = () => {
  const navigate = useNavigate();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLeagues = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/leagues');
      setLeagues(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar ligas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeagues();
  }, [loadLeagues]);

  const copySignupLink = async (slug) => {
    const base = window.location.origin;
    const url = `${base}/leagues/signup/${encodeURIComponent(slug)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Enlace de inscripción copiado');
  };

  const copyStandingsLink = async (slug) => {
    const base = window.location.origin;
    const url = `${base}/leagues/standings/${encodeURIComponent(slug)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Enlace de clasificación copiado');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="size-6" />
            Ligas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agrupa varias competiciones en un campeonato a largo plazo
          </p>
        </div>
        <Button onClick={() => navigate('/leagues/create')}>
          <Plus className="size-4 mr-2" />
          Nueva liga
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {leagues.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No tienes ligas creadas todavía.</p>
            <Button onClick={() => navigate('/leagues/create')}>
              <Plus className="size-4 mr-2" />
              Crear primera liga
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {leagues.map((league) => (
            <Card key={league.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/leagues/${league.id}`} className="font-semibold text-lg hover:underline">
                      {league.name}
                    </Link>
                    <LeagueStatusBadge status={league.status} />
                    <Badge variant="outline">{SCORING_LABEL[league.scoring_mode] || league.scoring_mode}</Badge>
                  </div>
                  {league.clubs?.name && (
                    <p className="text-sm text-muted-foreground">Club: {league.clubs.name}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {league.competitions_count ?? 0} prueba{(league.competitions_count ?? 0) !== 1 ? 's' : ''}
                    {league.competitions_closed_count != null
                      ? ` (${league.competitions_closed_count} cerrada${league.competitions_closed_count !== 1 ? 's' : ''})`
                      : ''}
                    {' · '}
                    {league.participants_count ?? 0} participante{(league.participants_count ?? 0) !== 1 ? 's' : ''}
                    {league.leader
                      ? ` · Líder: ${league.leader.name} (${league.leader.total_points} pts)`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {league.status !== 'draft' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => copySignupLink(league.slug)}>
                        <Link2 className="size-4 mr-2" />
                        Inscripción
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyStandingsLink(league.slug)}>
                        <BarChart3 className="size-4 mr-2" />
                        Clasificación
                      </Button>
                    </>
                  )}
                  <Button size="sm" asChild>
                    <Link to={`/leagues/${league.id}`}>Gestionar</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leagues;
