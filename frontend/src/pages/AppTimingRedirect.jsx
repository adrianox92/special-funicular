import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { buildAppTimingDeepLink } from '../utils/appTimingLink';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { useLapTimerPremium } from '../hooks/useLapTimerPremium';
import LapTimerPremiumNotice from '../components/LapTimerPremiumNotice';

export default function AppTimingRedirect() {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);
  const { isPremium, loading: premiumLoading } = useLapTimerPremium();
  const [searchParams] = useSearchParams();

  const vehicleId = searchParams.get('vehicle_id') || '';
  const circuitId = searchParams.get('circuit_id') || '';
  const lane = searchParams.get('lane') || '';
  const guided = searchParams.get('guided') !== '0';

  const deepLink = useMemo(
    () =>
      vehicleId
        ? buildAppTimingDeepLink({
            vehicleId,
            circuitId: circuitId || undefined,
            lane: lane || undefined,
            guided,
          })
        : null,
    [vehicleId, circuitId, lane, guided],
  );

  useEffect(() => {
    if (!isAdmin || !deepLink) return;
    window.location.href = deepLink;
  }, [deepLink, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-lg">Slot Lap Timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              La integración con Slot Lap Timer está en prueba y solo está disponible para
              administradores de la plataforma.
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="size-5" />
            Abrir Slot Lap Timer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {!vehicleId ? (
            <p>Falta el parámetro vehicle_id en el enlace.</p>
          ) : (
            <>
              <p>
                Si tienes Slot Lap Timer instalada, debería abrirse automáticamente con el vehículo
                y circuito seleccionados.
              </p>
              {!premiumLoading && !isPremium && guided && (
                <LapTimerPremiumNotice compact />
              )}
              {deepLink && (
                <Button asChild className="w-full">
                  <a href={deepLink}>Abrir en la app</a>
                </Button>
              )}
              <p className="text-xs">
                La app aún no está publicada en las tiendas; necesitas una instalación de prueba.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
