import React, { createContext, useContext, useMemo, useState } from 'react';
import { useVehicleCore } from './useVehicleCore';
import { useVehicleSpecs } from './useVehicleSpecs';
import { useVehicleTimings } from './useVehicleTimings';

const EditVehicleContext = createContext(null);

export function EditVehicleProvider({ id, children }) {
  const core = useVehicleCore(id);
  const specs = useVehicleSpecs(id, {
    t: core.t,
    setError: core.setError,
    setDeleteConfirm: core.setDeleteConfirm,
    deleteConfirm: core.deleteConfirm,
  });
  const timings = useVehicleTimings(id, {
    t: core.t,
    error: core.error,
    setError: core.setError,
    setDeleteConfirm: core.setDeleteConfirm,
    deleteConfirm: core.deleteConfirm,
  });
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);

  const value = useMemo(
    () => ({
      id,
      ...core,
      ...specs,
      ...timings,
      maintenanceLogs,
      setMaintenanceLogs,
    }),
    [id, core, specs, timings, maintenanceLogs],
  );

  return (
    <EditVehicleContext.Provider value={value}>
      {children}
    </EditVehicleContext.Provider>
  );
}

export function useEditVehicle() {
  const ctx = useContext(EditVehicleContext);
  if (!ctx) {
    throw new Error('useEditVehicle must be used within EditVehicleProvider');
  }
  return ctx;
}
