import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, Loader2, CalendarDays, Megaphone, Building2, Trophy } from 'lucide-react';
import axios from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import ClubCalendar from '../components/ClubCalendar';
import ClubBoard from '../components/ClubBoard';

const ADMIN_TABS = new Set(['members', 'board', 'calendar', 'leagues']);
const MEMBER_TABS = new Set(['board', 'calendar', 'leagues']);

const ClubMembers = () => {
  const { id: clubId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kickTarget, setKickTarget] = useState(null);
  const [roleUpdating, setRoleUpdating] = useState({});

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    description: '',
    city: '',
    website_url: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);
      const clubRes = await axios.get(`/clubs/${clubId}`);
      setClub(clubRes.data);
      const isManager =
        clubRes.data?.my_role === 'admin' || user?.id === clubRes.data?.owner_user_id;

      if (isManager) {
        const membersRes = await axios.get(`/clubs/${clubId}/members`);
        const payload = membersRes.data;
        const list = Array.isArray(payload?.members) ? payload.members : Array.isArray(payload) ? payload : [];
        setMembers(list);
        setOwnerUserId(payload?.owner_user_id ?? clubRes.data?.owner_user_id ?? null);
      } else {
        setMembers([]);
        setOwnerUserId(clubRes.data?.owner_user_id ?? null);
      }
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || 'No se pudo cargar el club');
      setClub(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [clubId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = club && (club.my_role === 'admin' || user?.id === club.owner_user_id);

  const tabParam = searchParams.get('tab');
  const activeTab = canManage
    ? ADMIN_TABS.has(tabParam)
      ? tabParam
      : 'members'
    : MEMBER_TABS.has(tabParam)
      ? tabParam
      : 'board';

  const onTabChange = (value) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  const handleRoleChange = async (memberUserId, newRole) => {
    if (!canManage || !clubId) return;
    setRoleUpdating((s) => ({ ...s, [memberUserId]: true }));
    try {
      await axios.patch(`/clubs/${clubId}/members/${memberUserId}`, { role: newRole });
      toast.success('Rol actualizado');
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo cambiar el rol');
    } finally {
      setRoleUpdating((s) => ({ ...s, [memberUserId]: false }));
    }
  };

  const confirmKick = async () => {
    if (!kickTarget || !clubId) return;
    try {
      await axios.delete(`/clubs/${clubId}/members/${kickTarget.user_id}`);
      toast.success('Miembro expulsado');
      setKickTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo expulsar');
    }
  };

  const saveClubProfile = async () => {
    if (!clubId) return;
    try {
      setProfileSaving(true);
      await axios.patch(`/clubs/${clubId}`, {
        description: profileForm.description.trim() || null,
        city: profileForm.city.trim() || null,
        website_url: profileForm.website_url.trim() || null,
      });
      toast.success('Ficha del club actualizada');
      setProfileOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo guardar');
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2" onClick={() => navigate('/clubs')}>
          <ArrowLeft className="size-4" />
          Volver a clubes
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error || 'Club no encontrado'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate('/clubs')}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Volver</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {canManage ? <Users className="size-7" /> : <Building2 className="size-7" />}
              {club.name}
            </h1>
            <p className="text-muted-foreground">
              {canManage ? 'Miembros, tablón y calendario' : 'Tablón de avisos y calendario de eventos'}
            </p>
          </div>
        </div>
        {canManage && club.slug ? (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                window.open(`${window.location.origin}/club/${encodeURIComponent(club.slug)}`, '_blank', 'noopener,noreferrer')
              }
            >
              Ver ficha pública
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => {
                setProfileForm({
                  description: club.description || '',
                  city: club.city || '',
                  website_url: club.website_url || '',
                });
                setProfileOpen(true);
              }}
            >
              Editar ficha pública
            </Button>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <>
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <TabsList className="grid w-full max-w-3xl grid-cols-4">
              <TabsTrigger value="members" className="gap-2">
                <Users className="size-4 shrink-0" />
                Miembros
              </TabsTrigger>
              <TabsTrigger value="board" className="gap-2">
                <Megaphone className="size-4 shrink-0" />
                Tablón
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarDays className="size-4 shrink-0" />
                Calendario
              </TabsTrigger>
              <TabsTrigger value="leagues" className="gap-2">
                <Trophy className="size-4 shrink-0" />
                Ligas
              </TabsTrigger>
            </TabsList>
            <TabsContent value="members" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Lista de miembros</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Alta</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay miembros
                          </TableCell>
                        </TableRow>
                      ) : (
                        members.map((m) => {
                          const isOwner = m.is_owner || m.user_id === ownerUserId;
                          const showActions = canManage && !isOwner;
                          return (
                            <TableRow key={m.id || m.user_id}>
                              <TableCell className="font-medium">
                                {m.email || m.user_id}
                                {isOwner && (
                                  <Badge variant="secondary" className="ml-2">
                                    Propietario
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {showActions ? (
                                  <Select
                                    value={m.role}
                                    onValueChange={(v) => handleRoleChange(m.user_id, v)}
                                    disabled={roleUpdating[m.user_id]}
                                  >
                                    <SelectTrigger className="w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="member">Miembro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge variant={m.role === 'admin' ? 'default' : 'outline'}>
                                    {m.role === 'admin' ? 'Admin' : 'Miembro'}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{formatDate(m.joined_at)}</TableCell>
                              <TableCell className="text-right">
                                  {showActions ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => setKickTarget(m)}
                                    >
                                      Expulsar
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">—</span>
                                  )}
                                </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="board" className="mt-4">
              <ClubBoard clubId={clubId} canManage />
            </TabsContent>
            <TabsContent value="calendar" className="mt-4">
              <ClubCalendar clubId={clubId} canManage={canManage} />
            </TabsContent>
            <TabsContent value="leagues" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ligas del club</CardTitle>
                </CardHeader>
                <CardContent>
                  {(club.leagues || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay ligas publicadas en este club.</p>
                  ) : (
                    <ul className="space-y-3">
                      {(club.leagues || []).map((lg) => (
                        <li key={lg.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-md p-3">
                          <div>
                            <Link to={`/leagues/${lg.id}`} className="font-medium hover:underline">
                              {lg.name}
                            </Link>
                            <p className="text-xs text-muted-foreground mt-1">
                              {lg.competitions_count ?? 0} pruebas · {lg.participants_count ?? 0} participantes
                            </p>
                          </div>
                          <Badge variant="outline">{lg.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Ficha pública del club</DialogTitle>
                <DialogDescription>
                  Visible en la página pública del club (nombre y próximos eventos siempre; estos campos son opcionales).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="club-desc">Descripción</Label>
                  <Textarea
                    id="club-desc"
                    rows={4}
                    value={profileForm.description}
                    onChange={(e) => setProfileForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Presentación del club para nuevos visitantes..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="club-city">Ciudad</Label>
                  <Input
                    id="club-city"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Ej: Madrid"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="club-web">Sitio web</Label>
                  <Input
                    id="club-web"
                    type="url"
                    value={profileForm.website_url}
                    onChange={(e) => setProfileForm((f) => ({ ...f, website_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={profileSaving} onClick={saveClubProfile}>
                  {profileSaving ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={Boolean(kickTarget)} onOpenChange={(open) => !open && setKickTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Expulsar a este miembro?</AlertDialogTitle>
                <AlertDialogDescription>
                  {kickTarget?.email || kickTarget?.user_id} dejará de pertenecer al club.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={confirmKick}
                >
                  Expulsar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="board" className="gap-2">
              <Megaphone className="size-4 shrink-0" />
              Tablón
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="size-4 shrink-0" />
              Calendario
            </TabsTrigger>
            <TabsTrigger value="leagues" className="gap-2">
              <Trophy className="size-4 shrink-0" />
              Ligas
            </TabsTrigger>
          </TabsList>
          <TabsContent value="board" className="mt-4">
            <ClubBoard clubId={clubId} canManage={false} />
          </TabsContent>
          <TabsContent value="calendar" className="mt-4">
            <ClubCalendar clubId={clubId} canManage={false} />
          </TabsContent>
          <TabsContent value="leagues" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ligas del club</CardTitle>
              </CardHeader>
              <CardContent>
                {(club.leagues || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay ligas publicadas en este club.</p>
                ) : (
                  <ul className="space-y-3">
                    {(club.leagues || []).map((lg) => (
                      <li key={lg.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-md p-3">
                        <div>
                          <Link to={`/leagues/${lg.id}`} className="font-medium hover:underline">
                            {lg.name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-1">
                            {lg.competitions_count ?? 0} pruebas · {lg.participants_count ?? 0} participantes
                          </p>
                        </div>
                        <Badge variant="outline">{lg.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ClubMembers;
