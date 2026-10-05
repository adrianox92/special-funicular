import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { Spinner } from '../ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import CatalogTechSpecsFields from '../CatalogTechSpecsFields';
import { techSpecFormFromRow } from '../../data/catalogTechSpecs';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleCarSpecsTab() {
  const { t } = useTranslation('vehicles');
  const { t: tCommon } = useTranslation('common');
  const { vehicle, setVehicle, error, saving, navigate, handleSubmit } = useEditVehicle();

  const specForm = useMemo(() => techSpecFormFromRow(vehicle || {}), [vehicle]);

  const setSpecForm = (updater) => {
    setVehicle((prev) => {
      const current = techSpecFormFromRow(prev || {});
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, ...next };
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('edit.cards.carSpecs')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CatalogTechSpecsFields form={specForm} setForm={setSpecForm} idPrefix="vehicle-tech" />
        </CardContent>
      </Card>
      {error && (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      )}
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="secondary" type="button" onClick={() => navigate('/vehicles')}>
          {tCommon('actions.cancel')}
        </Button>
        <Button type="submit" name="save-vehicle" disabled={saving}>
          {saving ? (
            <>
              <Spinner className="size-4 mr-2" />
              {t('edit.saving')}
            </>
          ) : (
            t('edit.update')
          )}
        </Button>
      </div>
    </form>
  );
}
