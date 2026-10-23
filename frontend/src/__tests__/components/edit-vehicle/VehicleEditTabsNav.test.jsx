import React from 'react';
import { render, screen } from '@testing-library/react';
import VehicleEditTabsNav from '../../../components/edit-vehicle/VehicleEditTabsNav';
import { Tabs } from '../../../components/ui/tabs';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

jest.mock('../../../components/edit-vehicle/EditVehicleContext', () => ({
  useEditVehicle: () => ({ timings: [] }),
}));

jest.mock('../../../components/SetupPerformanceAnalysis', () => ({
  hasMultipleConfigs: () => false,
}));

describe('VehicleEditTabsNav', () => {
  test('una sola pestaña de specs: Especificaciones técnicas, sin Información técnica duplicada', () => {
    render(
      <Tabs value="general">
        <VehicleEditTabsNav
          activeTab="general"
          onTabChange={() => {}}
          tabOptions={[
            { value: 'general', label: 'edit.tabs.general' },
            { value: 'technical', label: 'edit.tabs.technical' },
          ]}
        />
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'edit.tabs.technical' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'edit.tabs.carSpecs' })).not.toBeInTheDocument();
  });
});
