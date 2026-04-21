import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Plus, Link2, LogOut, Loader2, Users } from 'lucide-react';
import axios from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { PENDING_CLUB_INVITE_KEY } from '../components/PendingInviteConsumer';

const Clubs = () => {
  const { user } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/clubs/mine');
      setClubs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError('No se pudieron cargar los clubes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token?.trim()) return;
    (async () => {
      try {
        const { data } = await axios.post(`/clubs/join/${encodeURIComponent(token.trim())}`);
        if (data?.already_member) {
          toast.info('Ya eras miembro de este club');
        } else {
          toast.success('Te has unido al club');
        }
        navigate('/clubs', { replace: true });
        load();
      } catch (e) {
        toast.error(e.response?.data?.error || 'No se pudo unir al club');
        navigate('/clubs', { replace: true });
      }
    })();
  }, [searchParams, navigate, load]);

  /** Invitación guardada en sessionStorage (p. ej. login tras /clubs/join sin sesión). */
  useEffect(() => {
    if (!user) return;
    if (searchParams.get('token')?.trim()) return;

    const stored = sessionStorage.getItem(PENDING_CLUB_INVITE_KEY)?.trim();
    if (!stored) return;

    (async () => {
      try {
        const { data } = await axios.post(`/clubs/join/${encodeURIComponent(stored)}`);
        sessionStorage.removeItem(PENDING_CLUB_INVITE_KEY);
        if (data?.already_member) {
          toast.info('Ya eras miembro de este club');
        } else {
          toast.success('Te has unido al club');
        }
        load();
      } catch (e) {
        sessionStorage.removeItem(PENDING_CLUB_INVITE_KEY);
        toast.error(e.response?.data?.error || 'No se pudo unir al club');
      }
    })();
  }, [user, searchParams, load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    try {
      setCreating(true);
      await axios.post('/clubs', { name: createName.trim() });
      toast.success('Club creado');
      setCreateOpen(false);
      setCreateName('');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al crear el club');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (clubId) => {
    try {
      const { data } = await axios.post(`/clubs/${clubId}/invite`, { expires_in_days: 14 });
      const url = data.join_url || data.joinUrl;
      if (url && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success('Enlace de invitación copiado al portapapeles');
      } else if (url) {
        toast.message(url);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo generar la invitación');
    }
  };

  const handleLeave = async (club) => {
    if (!user?.id) {
      toast.error('Sesión no válida');
      return;
    }
    if (club.owner_user_id === user.id) {
      toast.error('Como propietario no puedes abandonar el club desde aquí.');
      return;
    }
    try {
      await axios.delete(`/clubs/${club.id}/members/${user.id}`);
      toast.success('Has abandonado el club');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al abandonar');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="size-7" />
            Clubes
          </h1>
          <p className="text-muted-foreground">
            Crea un club, invita miembros y asocia competiciones. Para licencias multi-PC del Slot Race Manager,
            pega el UUID del club en la configuración de licencia de la app de escritorio.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Nuevo club
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Crear club</DialogTitle>
                <DialogDescription>Nombre visible para los miembros.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="club-name">Nombre</Label>
                <Input
                  id="club-name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ej: Club Slot Valencia"
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating || !createName.trim()}>
                  {creating ? 'Creando…' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No perteneces a ningún club. Crea uno o acepta una invitación.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {clubs.map((c) => {
            const isOwner = user?.id && c.owner_user_id === user.id;
            const canInvite = c.my_role === 'admin' || isOwner;
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                    {c.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      {isOwner ? '(propietario)' : c.my_role === 'admin' ? '(admin)' : '(miembro)'}
                    </span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono break-all">UUID: {c.id}</p>
                  <p className="text-xs text-muted-foreground">
                    Instalaciones licencia (club): hasta {c.license_installations_max ?? 10} PCs
                  </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {canInvite && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => navigate(`/clubs/${c.id}/members`)}
                      >
                        <Users className="size-3.5" />
                        Miembros
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleInvite(c.id)}>
                        <Link2 className="size-3.5" />
                        Invitar (copiar enlace)
                      </Button>
                    </>
                  )}
                  {!isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive gap-1"
                      onClick={() => handleLeave(c)}
                    >
                      <LogOut className="size-3.5" />
                      Abandonar
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Clubs;
