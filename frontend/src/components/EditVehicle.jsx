import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'react-router-dom';
import SetupPerformanceAnalysis, { hasMultipleConfigs } from './SetupPerformanceAnalysis';
import VehicleImageCarouselDialog from './VehicleImageCarouselDialog';
import TimingSpecsModal from './TimingSpecsModal';
import SessionPerformanceModal from './SessionPerformanceModal';
import VehiclePalmares from './VehiclePalmares';
import { Alert } from './ui/alert';
import { Spinner } from './ui/spinner';
import { Tabs, TabsContent } from './ui/tabs';
import { EditVehicleProvider, useEditVehicle } from './edit-vehicle/EditVehicleContext';
import VehicleDeleteConfirmDialog from './edit-vehicle/VehicleDeleteConfirmDialog';
import VehicleEditHeader from './edit-vehicle/VehicleEditHeader';
import VehicleEditTabsNav from './edit-vehicle/VehicleEditTabsNav';
import VehicleGeneralTab from './edit-vehicle/VehicleGeneralTab';
import VehicleMaintenanceTab from './edit-vehicle/VehicleMaintenanceTab';
import VehicleQrDialog from './edit-vehicle/VehicleQrDialog';
import VehicleSpecReturnDialog from './edit-vehicle/VehicleSpecReturnDialog';
import VehicleSpecsTab from './edit-vehicle/VehicleSpecsTab';
import VehicleTimingsTab from './edit-vehicle/VehicleTimingsTab';
import InventoryPickerDialog from './edit-vehicle/InventoryPickerDialog';

function EditVehicleShell() {
  const { t } = useTranslation('vehicles');
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('general');
  const {
    vehicle,
    loading,
    error,
    timings,
    galleryOpen,
    setGalleryOpen,
    gallerySlides,
    galleryStartIndex,
    showSpecsModal,
    setShowSpecsModal,
    selectedTiming,
    showPerformanceModal,
    setShowPerformanceModal,
    performanceTiming,
    id,
  } = useEditVehicle();

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('tab') === 'maintenance' || location.hash === '#maintenance') {
      setActiveTab('maintenance');
    }
    if (q.get('tab') === 'palmares' || location.hash === '#palmares') {
      setActiveTab('palmares');
    }
  }, [location.search, location.hash]);

  const vehicleTabOptions = useMemo(
    () => [
      { value: 'general', label: t('edit.tabs.general') },
      { value: 'technical', label: t('edit.tabs.technical') },
      { value: 'modifications', label: t('edit.tabs.modifications') },
      { value: 'timings', label: t('edit.tabs.timings') },
      ...(hasMultipleConfigs(timings) ? [{ value: 'config-analysis', label: t('edit.tabs.configAnalysis') }] : []),
      { value: 'maintenance', label: t('edit.tabs.maintenance') },
      { value: 'palmares', label: t('edit.tabs.palmares') },
    ],
    [t, timings],
  );

  if (loading || !vehicle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <Alert variant="destructive">{error}</Alert>
      </div>
    );
  }

  return (
    <>
      <VehicleSpecReturnDialog />
      <VehicleDeleteConfirmDialog />
      <VehicleImageCarouselDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        slides={gallerySlides}
        initialIndex={galleryStartIndex}
      />

      <div className="container mt-4">
        <VehicleQrDialog />
        <VehicleEditHeader />
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <VehicleEditTabsNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabOptions={vehicleTabOptions}
          />

          <TabsContent value="general">
            <VehicleGeneralTab />
          </TabsContent>

          <TabsContent value="technical">
            <VehicleSpecsTab isModificationTab={false} />
          </TabsContent>

          <TabsContent value="modifications">
            <VehicleSpecsTab isModificationTab={true} />
          </TabsContent>

          <InventoryPickerDialog />

          <TabsContent value="timings">
            <VehicleTimingsTab />
          </TabsContent>
          {hasMultipleConfigs(timings) && (
            <TabsContent value="config-analysis">
              <SetupPerformanceAnalysis timings={timings} />
            </TabsContent>
          )}
          <TabsContent value="maintenance">
            <VehicleMaintenanceTab />
          </TabsContent>
          <TabsContent value="palmares">
            <VehiclePalmares vehicleId={id} />
          </TabsContent>
        </Tabs>

        <TimingSpecsModal
          show={showSpecsModal}
          onHide={() => setShowSpecsModal(false)}
          setupSnapshot={selectedTiming?.setup_snapshot}
          timing={selectedTiming}
        />
        <SessionPerformanceModal
          show={showPerformanceModal}
          onHide={() => setShowPerformanceModal(false)}
          timing={performanceTiming}
          vehicle={vehicle}
        />
      </div>
    </>
  );
}

const EditVehicle = () => {
  const { id } = useParams();
  return (
    <EditVehicleProvider id={id}>
      <EditVehicleShell />
    </EditVehicleProvider>
  );
};

export default EditVehicle;
