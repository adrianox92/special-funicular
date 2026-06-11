import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Trophy, ArrowLeft } from 'lucide-react';
import axios from '../lib/axios';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import LeagueStandingsTable from '../components/league/LeagueStandingsTable';
import LeagueStatusBadge from '../components/league/LeagueStatusBadge';

const headerImgClass =
  'h-9 w-auto max-w-[min(100%,14rem)] object-contain object-left sm:max-w-[16rem]';

const LeagueStandings = () => {
  const { slug } = useParams();
  const { theme } = useTheme();
  const headerLogoSrc = `${process.env.PUBLIC_URL || ''}/${
    theme === 'dark' ? 'logo-header.png' : 'logo-header-dark.png'
  }`;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/public-leagues/${slug}/standings`);
        setData(res.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Liga no encontrada');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="link" asChild className="mt-4">
          <Link to="/"><ArrowLeft className="size-4 mr-2" />Volver al inicio</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b px-4 py-3">
        <Link to="/">
          <img src={headerLogoSrc} alt="Slot Database" className={headerImgClass} />
        </Link>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="size-5" />
              <h1 className="text-2xl font-bold">{data.league.name}</h1>
              <LeagueStatusBadge status={data.league.status} />
            </div>
            <p className="text-muted-foreground text-sm mt-1">Clasificación acumulada</p>
          </div>
          {data.league.status !== 'closed' && (
            <Button variant="outline" asChild>
              <Link to={`/leagues/signup/${slug}`}>Inscribirse</Link>
            </Button>
          )}
        </div>

        <LeagueStandingsTable
          standings={data.standings || []}
          competitions={data.competitions || []}
          countingRaces={data.league?.counting_races}
          exportBasePath={`/public-leagues/${slug}`}
          leagueName={data.league?.name}
        />
      </main>
    </div>
  );
};

export default LeagueStandings;
