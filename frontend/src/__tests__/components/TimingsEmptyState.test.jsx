import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        emptyTitle: 'Aún no hay tiempos',
        emptyHint: 'La forma más rápida es una sesión. No hace falta abrir la ficha del vehículo.',
        emptyHintWithVehicles: 'Tienes coches en el garaje, pero todavía no hay sesiones.',
        emptyCta: 'Nueva sesión',
      };
      return map[key] ?? key;
    },
  }),
}));

import TimingsEmptyState from '../../components/TimingsEmptyState';

function renderEmpty(hasVehicles) {
  return render(
    <MemoryRouter>
      <TimingsEmptyState hasVehicles={hasVehicles} />
    </MemoryRouter>,
  );
}

describe('TimingsEmptyState', () => {
  test('CTA primaria apunta a Nueva sesión', () => {
    renderEmpty(true);
    const cta = screen.getByTestId('timings-empty-session-cta');
    expect(cta).toHaveAttribute('href', '/session');
    expect(cta).toHaveTextContent('Nueva sesión');
    expect(screen.getByText(/Tienes coches en el garaje/i)).toBeInTheDocument();
  });

  test('sin vehículos explica la sesión sin exigir la ficha del coche', () => {
    renderEmpty(false);
    expect(screen.getByTestId('timings-empty-session-cta')).toHaveAttribute('href', '/session');
    expect(screen.getByText(/No hace falta abrir la ficha/i)).toBeInTheDocument();
  });
});
