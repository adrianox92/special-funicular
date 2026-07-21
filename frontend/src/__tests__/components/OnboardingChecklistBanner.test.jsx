import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (key === 'progress' && opts) return `${opts.done}/${opts.total} completados`;
      const map = {
        title: 'Primeros pasos',
        'steps.vehicle': 'Añadir tu primer vehículo',
        'steps.circuit': 'Crear tu primer circuito',
        'steps.timing': 'Registrar tu primer tiempo',
        cta: 'Continuar',
        dismiss: 'Ocultar checklist',
      };
      return map[key] ?? key;
    },
  }),
}));

const mockDismiss = jest.fn();
const mockUseOnboardingStatus = jest.fn();

jest.mock('../../hooks/useOnboardingStatus', () => ({
  useOnboardingStatus: () => mockUseOnboardingStatus(),
}));

import OnboardingChecklistBanner from '../../components/OnboardingChecklistBanner';

function renderBanner() {
  return render(<OnboardingChecklistBanner />);
}

describe('OnboardingChecklistBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDismiss.mockResolvedValue(undefined);
  });

  test('visible cuando hay pasos incompletos y no está dismissed', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: false },
        { id: 'circuit', path: '/circuits', done: false },
        { id: 'timing', path: '/timings', done: false },
      ],
      completedCount: 0,
      visible: true,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'vehicle', path: '/vehicles/new', done: false },
    });

    renderBanner();

    expect(screen.getByTestId('onboarding-checklist-banner')).toBeInTheDocument();
    expect(screen.getByText('0/3 completados')).toBeInTheDocument();
  });

  test('oculto cuando onboarding completado', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: true },
        { id: 'circuit', path: '/circuits', done: true },
        { id: 'timing', path: '/timings', done: true },
      ],
      completedCount: 3,
      visible: false,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: null,
    });

    renderBanner();

    expect(screen.queryByTestId('onboarding-checklist-banner')).not.toBeInTheDocument();
  });

  test('oculto cuando dismissed', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: false },
        { id: 'circuit', path: '/circuits', done: false },
        { id: 'timing', path: '/timings', done: false },
      ],
      completedCount: 0,
      visible: false,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'vehicle', path: '/vehicles/new', done: false },
    });

    renderBanner();

    expect(screen.queryByTestId('onboarding-checklist-banner')).not.toBeInTheDocument();
  });

  test('CTA apunta al primer paso incompleto', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: true },
        { id: 'circuit', path: '/circuits', done: false },
        { id: 'timing', path: '/timings', done: false },
      ],
      completedCount: 1,
      visible: true,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'circuit', path: '/circuits', done: false },
    });

    renderBanner();

    const cta = screen.getByTestId('onboarding-cta');
    expect(cta).toHaveAttribute('href', '/circuits');
    expect(cta).toHaveTextContent('Continuar');
  });
});
