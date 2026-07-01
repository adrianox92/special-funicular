import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { buildAppTimingRedirectUrl } from '../utils/appTimingLink';
import { Button } from './ui/button';

/**
 * Enlace a entrenamiento guiado sin peticiones API (sustituye LapTimerTrainingCard compact).
 */
export default function LapTimerTrainingLink({ vehicleId, circuitId, lane }) {
  const { t } = useTranslation('common');
  const { user } = useAuth();

  if (!isLicenseAdminUser(user) || !vehicleId || !circuitId) return null;

  const redirectUrl = buildAppTimingRedirectUrl({
    vehicleId,
    circuitId,
    lane,
    guided: true,
  });

  return (
    <Button variant="outline" size="sm" asChild title={t('training.compactTitle')}>
      <Link to={redirectUrl}>
        <Smartphone className="size-3.5 mr-1" />
        {t('training.lapTimerBtn')}
      </Link>
    </Button>
  );
}
