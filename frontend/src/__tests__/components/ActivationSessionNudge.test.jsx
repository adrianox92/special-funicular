import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ACTIVATION_NUDGE_STORAGE } from '../../utils/activationNudge';

const MARCH = new Date('2026-03-18T12:00:00.000Z');

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        'activationNudge.firstTitle': 'Registra tu primer tiempo',
        'activationNudge.firstBody': 'Ya tienes coche en el garaje.',
        'activationNudge.staleTitle': 'Hace más de 30 días que no ruedas',
        'activationNudge.staleBody': 'Abre una sesión corta.',
        'activationNudge.quiet.week.title': '¿Sacas la pista esta semana?',
        'activationNudge.quiet.week.body': 'Una sesión corta basta.',
        'activationNudge.quiet.rhythm.title': 'El garaje echa de menos un tiempo',
        'activationNudge.quiet.rhythm.body': 'Una tanda corta.',
        'activationNudge.quiet.short.title': '¿Una tanda corta esta semana?',
        'activationNudge.quiet.short.body': 'No hace falta una sesión larga.',
        'activationNudge.quiet.holiday.title': 'Entre fiestas, un rato de pista también cuenta',
        'activationNudge.quiet.holiday.body': 'Una sesión corta mantiene el hábito.',
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
      <ActivationSessionNudge now={MARCH} {...props} />
    </MemoryRouter>,
  );
}

describe('ActivationSessionNudge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('muestra CTA a /session para el primer tiempo', () => {
    renderNudge({ totalVehicles: 1, totalTimings: 0, timingsLast30Days: 0, timingsLast14Days: 0 });

    expect(screen.getByTestId('activation-session-nudge')).toHaveAttribute('data-variant', 'first');
    expect(screen.getByTestId('activation-session-nudge-cta')).toHaveAttribute('href', '/session');
    expect(screen.getByText('Registra tu primer tiempo')).toBeInTheDocument();
  });

  test('no muestra el primer tiempo si el onboarding global ya cubre el CTA', () => {
    renderNudge({
      totalVehicles: 1,
      totalTimings: 0,
      timingsLast30Days: 0,
      timingsLast14Days: 0,
      suppressFirst: true,
    });
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
  });

  test('no se muestra si hay tiempos en 14 días', () => {
    renderNudge({ totalVehicles: 2, totalTimings: 5, timingsLast30Days: 1, timingsLast14Days: 1 });
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
  });

  test('muestra el nudge suave a 14 días sin apilarse con stale', () => {
    renderNudge({ totalVehicles: 2, totalTimings: 5, timingsLast30Days: 2, timingsLast14Days: 0 });

    const card = screen.getByTestId('activation-session-nudge');
    expect(card).toHaveAttribute('data-variant', 'quiet');
    expect(card).toHaveAttribute('data-copy');
    expect(screen.getByTestId('activation-session-nudge-cta')).toHaveAttribute('href', '/session');
    expect(screen.queryByText('Hace más de 30 días que no ruedas')).not.toBeInTheDocument();
  });

  test('se oculta al descartar y persiste en localStorage', () => {
    renderNudge({ totalVehicles: 1, totalTimings: 3, timingsLast30Days: 0, timingsLast14Days: 0 });

    expect(screen.getByTestId('activation-session-nudge')).toHaveAttribute('data-variant', 'stale');
    fireEvent.click(screen.getByTestId('activation-session-nudge-dismiss'));
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACTIVATION_NUDGE_STORAGE.stale)).toBe('1');
  });

  test('quiet se pospone 7 días en localStorage', () => {
    renderNudge({ totalVehicles: 2, totalTimings: 5, timingsLast30Days: 2, timingsLast14Days: 0 });

    fireEvent.click(screen.getByTestId('activation-session-nudge-dismiss'));
    expect(screen.queryByTestId('activation-session-nudge')).not.toBeInTheDocument();
    const until = Date.parse(localStorage.getItem(ACTIVATION_NUDGE_STORAGE.quiet));
    expect(until).toBeGreaterThan(MARCH.getTime());
  });
});
