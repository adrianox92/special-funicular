import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ACTIVATION_NUDGE_STORAGE } from '../../utils/activationNudge';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        'activationNudge.firstTitle': 'Registra tu primer tiempo',
        'activationNudge.firstBody': 'Ya tienes coche en el garaje.',
        'activationNudge.staleTitle': 'Hace más de 30 días que no ruedas',
        'activationNudge.staleBody': 'Abre una sesión corta.',
        'activationNudge.cta': 'Nueva sesión',
        'activationNudge.dismiss': 'Ahora no',
      };
      return map[key] ?? key;
    },
  }),
}));

import ActivationSessionNudge from '../../components/ActivationSessionNudge';

function renderNudge(props) {
  return render(
    <MemoryRouter>
      <ActivationSessionNudge {...props} />
    </MemoryRouter>,
  );
}

describe('ActivationSessionNudge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('muestra CTA a /session para el primer tiempo', () => {
    renderNudge({ totalVehicles: 1, totalTimings: 0, timingsLast30Days: 0 });

    expect(screen.getByTestId('activation-session-nudge')).toHaveAttribute('data-variant', 'first');
    expect(screen.getByTestId('activation-session-nudge-cta')).toHaveAttribute('href', '/session');
    expect(screen.getByText('Registra tu primer tiempo')).toBeInTheDocument();
  });

  test('no se muestra si hay tiempos en 30 días', () => {
    renderNudge({ totalVehicles: 2, totalTimings: 5, timingsLast30Days: 1 });
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
  });

  test('se oculta al descartar y persiste en localStorage', () => {
    renderNudge({ totalVehicles: 1, totalTimings: 3, timingsLast30Days: 0 });

    expect(screen.getByTestId('activation-session-nudge')).toHaveAttribute('data-variant', 'stale');
    fireEvent.click(screen.getByTestId('activation-session-nudge-dismiss'));
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACTIVATION_NUDGE_STORAGE.stale)).toBe('1');
  });
});
