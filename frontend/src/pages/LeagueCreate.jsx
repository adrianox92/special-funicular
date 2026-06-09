import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { toast } from 'sonner';

const LeagueCreate = () => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [form, setForm] = useState({
    name: '',
    club_id: '',
    scoring_mode: 'league_rules',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/clubs').then((res) => setClubs(res.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setCreating(true);
      setError(null);
      const res = await axios.post('/leagues', {
        name: form.name.trim(),
        club_id: form.club_id || undefined,
        scoring_mode: form.scoring_mode,
      });
      toast.success('Liga creada');
      navigate(`/leagues/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la liga');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Button variant="outline" size="sm" onClick={() => navigate('/leagues')}>
        <ArrowLeft className="size-4 mr-2" />
        Volver
      </Button>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="size-6" />
          Nueva liga
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crea un campeonato que agrupa varias competiciones a lo largo del tiempo
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="league-name">Nombre de la liga *</Label>
              <Input
                id="league-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Liga Invernal 2026"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Modo de puntuación</Label>
              <Select
                value={form.scoring_mode}
                onValueChange={(v) => setForm({ ...form, scoring_mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="league_rules">Reglas comunes para todas las pruebas</SelectItem>
                  <SelectItem value="per_competition">Cada prueba con sus propias reglas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Esta opción no se puede cambiar una vez añadidas pruebas o reglas.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Club (opcional)</Label>
              <Select
                value={form.club_id || '_none'}
                onValueChange={(v) => setForm({ ...form, club_id: v === '_none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin club</SelectItem>
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={creating} className="w-full">
              {creating ? <Spinner className="size-4" /> : 'Crear liga'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeagueCreate;
