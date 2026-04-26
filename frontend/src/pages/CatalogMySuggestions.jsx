import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';
import { labelMotorPosition } from '../data/motorPosition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const statusLabel = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export default function CatalogMySuggestions() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [changeReq, setChangeReq] = useState([]);
  const [insertReq, setInsertReq] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/catalog/my-requests');
      setChangeReq(data.change_requests ?? []);
      setInsertReq(data.insert_requests ?? []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Error al cargar');
      setChangeReq([]);
      setInsertReq([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis sugerencias al catálogo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Propuestas de corrección y altas nuevas pendientes de revisión por el equipo.
        </p>
        <p className="text-sm mt-2">
          <Link to="/catalogo" className="text-primary underline">
            Volver al catálogo público
          </Link>
        </p>
      </div>

      {loading ? (
        <Spinner className="mx-auto" />
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Correcciones propuestas</CardTitle>
              <CardDescription>Cambios sugeridos sobre una ficha existente.</CardDescription>
            </CardHeader>
            <CardContent>
              {changeReq.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguna.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ítem</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeReq.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.catalog_item_summary ? (
                            <div className="space-y-0.5">
                              <Link
                                to={`/catalogo/${r.catalog_item_summary.id}`}
                                className="font-mono text-sm text-primary hover:underline"
                              >
                                {r.catalog_item_summary.reference ?? '—'}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {r.catalog_item_summary.manufacturer} — {r.catalog_item_summary.model_name}
                              </div>
                            </div>
                          ) : r.catalog_item_id ? (
                            <span className="text-xs text-muted-foreground">Ficha no disponible</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{statusLabel[r.status] ?? r.status}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.created_at?.slice(0, 10) ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Altas propuestas</CardTitle>
              <CardDescription>Nuevos modelos que aún no están en el catálogo.</CardDescription>
            </CardHeader>
            <CardContent>
              {insertReq.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ninguna.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Marca / modelo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insertReq.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.proposed_reference}</TableCell>
                        <TableCell>
                          {r.proposed_manufacturer} — {r.proposed_model_name}
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {[r.proposed_traction, r.proposed_motor_position ? labelMotorPosition(r.proposed_motor_position) : null]
                              .filter(Boolean)
                              .join(' · ') || null}
                          </div>
                        </TableCell>
                        <TableCell>{statusLabel[r.status] ?? r.status}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.created_at?.slice(0, 10) ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
