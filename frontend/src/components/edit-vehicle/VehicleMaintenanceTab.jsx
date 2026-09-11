import React from 'react';
import MaintenanceCorrelationChart from '../charts/MaintenanceCorrelationChart';
import MaintenanceLog from '../MaintenanceLog';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleMaintenanceTab() {
  const { id, timings, maintenanceLogs, setMaintenanceLogs } = useEditVehicle();

  return (
    <>
      <MaintenanceCorrelationChart timings={timings} maintenanceLogs={maintenanceLogs} />
      <MaintenanceLog vehicleId={id} onLogsChange={setMaintenanceLogs} />
    </>
  );
}
