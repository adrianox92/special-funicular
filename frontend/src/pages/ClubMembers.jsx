import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';
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
import { toast } from 'sonner';

const ClubMembers = () => {
  const { id: clubId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [ownerUserId, setOwnerUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [kickTarget, setKickTarget] = useState(null);
  const [roleUpdating, setRoleUpdating] = useState({});

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      setError(null);
      const [clubRes, membersRes] = await Promise.all([
        axios.get(`/clubs/${clubId}`),
        axios.get(`/clubs/${clubId}/members`),
      ]);
      setClub(clubRes.data);
      const payload = membersRes.data;
      const list = Array.isArray(payload?.members) ? payload.members : Array.isArray(payload) ? payload : [];
      setMembers(list);
      setOwnerUserId(payload?.owner_user_id ?? clubRes.data?.owner_user_id ?? null);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.error || 'No se pudo cargar el club');
      setClub(null);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = club && (club.my_role === 'admin' || user?.id === club.owner_user_id);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate('/clubs')}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Volver</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="size-7" />
              Miembros
            </h1>
            <p className="text-muted-foreground">{club.name}</p>
          </div>
        </div>
      </div>

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
                {canManage && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground">
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
                      {canManage && (
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
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmKick}>
              Expulsar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClubMembers;
