import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (key === 'progress' && opts) return `${opts.done}/${opts.total} completados`;
      const map = {
        title: 'Primeros pasos',
        titleTiming: 'Registra tu primer tiempo',
        timingHint: 'Ya tienes coche en el garaje.',
        'steps.vehicle': 'Añadir tu primer vehículo',
        'steps.circuit': 'Crear tu primer circuito',
        'steps.timing': 'Registrar tu primer tiempo',
        cta: 'Continuar',
        ctaTiming: 'Nueva sesión',
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
  return render(
    <MemoryRouter>
      <OnboardingChecklistBanner />
    </MemoryRouter>,
  );
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
        { id: 'timing', path: '/session', done: false },
      ],
      completedCount: 0,
      visible: true,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'vehicle', path: '/vehicles/new', done: false },
      primaryStep: { id: 'vehicle', path: '/vehicles/new', done: false },
      needsFirstTiming: false,
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
        { id: 'timing', path: '/session', done: true },
      ],
      completedCount: 3,
      visible: false,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: null,
      primaryStep: null,
      needsFirstTiming: false,
    });

    renderBanner();

    expect(screen.queryByTestId('onboarding-checklist-banner')).not.toBeInTheDocument();
  });

  test('oculto cuando dismissed', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: false },
        { id: 'circuit', path: '/circuits', done: false },
        { id: 'timing', path: '/session', done: false },
      ],
      completedCount: 0,
      visible: false,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'vehicle', path: '/vehicles/new', done: false },
      primaryStep: { id: 'vehicle', path: '/vehicles/new', done: false },
      needsFirstTiming: false,
    });

    renderBanner();

    expect(screen.queryByTestId('onboarding-checklist-banner')).not.toBeInTheDocument();
  });

  test('CTA apunta al alta de vehículo si aún no hay garaje', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: false },
        { id: 'circuit', path: '/circuits', done: false },
        { id: 'timing', path: '/session', done: false },
      ],
      completedCount: 0,
      visible: true,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'vehicle', path: '/vehicles/new', done: false },
      primaryStep: { id: 'vehicle', path: '/vehicles/new', done: false },
      needsFirstTiming: false,
    });

    renderBanner();

    const cta = screen.getByTestId('onboarding-cta');
    expect(cta).toHaveAttribute('href', '/vehicles/new');
    expect(cta).toHaveTextContent('Continuar');
  });

  test('con vehículo y sin tiempos el CTA es Nueva sesión aunque falte circuito', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: true },
        { id: 'circuit', path: '/circuits', done: false },
        { id: 'timing', path: '/session', done: false },
      ],
      completedCount: 1,
      visible: true,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'circuit', path: '/circuits', done: false },
      primaryStep: { id: 'timing', path: '/session', done: false },
      needsFirstTiming: true,
    });

    renderBanner();

    expect(screen.getByTestId('onboarding-checklist-banner')).toHaveAttribute('data-emphasis', 'timing');
    expect(screen.getByText('Registra tu primer tiempo')).toBeInTheDocument();
    expect(screen.getByText('Ya tienes coche en el garaje.')).toBeInTheDocument();
    const cta = screen.getByTestId('onboarding-cta');
    expect(cta).toHaveAttribute('href', '/session');
    expect(cta).toHaveTextContent('Nueva sesión');
  });

  test('el paso de primer tiempo apunta a /session con CTA Nueva sesión', () => {
    mockUseOnboardingStatus.mockReturnValue({
      steps: [
        { id: 'vehicle', path: '/vehicles/new', done: true },
        { id: 'circuit', path: '/circuits', done: true },
        { id: 'timing', path: '/session', done: false },
      ],
      completedCount: 2,
      visible: true,
      dismiss: mockDismiss,
      loading: false,
      firstIncompleteStep: { id: 'timing', path: '/session', done: false },
      primaryStep: { id: 'timing', path: '/session', done: false },
      needsFirstTiming: true,
    });

    renderBanner();

    const cta = screen.getByTestId('onboarding-cta');
    expect(cta).toHaveAttribute('href', '/session');
    expect(cta).toHaveTextContent('Nueva sesión');
    expect(screen.getByText('Registra tu primer tiempo')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-checklist-banner')).toHaveAttribute('data-emphasis', 'timing');
    expect(screen.getByRole('link', { name: 'Registrar tu primer tiempo' })).toHaveAttribute('href', '/session');
  });
});
