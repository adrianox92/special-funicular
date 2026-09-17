import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts = {}) => {
      const map = {
        'myProgress.title': 'Mi progreso',
        'myProgress.desc': 'Un ritmo cómodo de hobby es 1 o 2 sesiones al mes.',
        'myProgress.sessionsThisMonth': 'Sesiones este mes',
        'myProgress.vsLastMonth': 'Vs mes anterior',
        'myProgress.deltaUp': `+${opts.count}`,
        'myProgress.deltaDown': `−${opts.count}`,
        'myProgress.deltaSame': 'Igual',
        'myProgress.lastSessionLabel': 'Última sesión',
        'myProgress.lastSessionToday': 'Última sesión hoy',
        'myProgress.lastSessionDays': `Última sesión hace ${opts.count} días`,
        'myProgress.lastSessionNever': 'Todavía no has cronometrado',
        'myProgress.weekStreak': `${opts.count} semanas seguidas con sesión`,
        'myProgress.zeroBody': 'Cuando quieras, una tanda corta basta para empezar.',
        'myProgress.emptyHint': 'Este mes aún no hay sesiones.',
        'myProgress.cta': 'Nueva sesión',
      };
      return map[key] ?? key;
    },
  }),
}));

import MyProgressCard from '../../components/MyProgressCard';

function renderCard(props) {
  return render(
    <MemoryRouter>
      <MyProgressCard {...props} />
    </MemoryRouter>,
  );
}

describe('MyProgressCard', () => {
  test('estado cero: copy amable y CTA a /session', () => {
    renderCard({
      progress: {
        sessionsThisMonth: 0,
        sessionsLastMonth: 0,
        lastSessionDate: null,
        daysSinceLastSession: null,
        consecutiveWeeksWithSession: 0,
      },
      totalTimings: 0,
    });

    expect(screen.getByTestId('my-progress-card')).toBeInTheDocument();
    expect(screen.getByText('Mi progreso')).toBeInTheDocument();
    expect(screen.getByText(/tanda corta basta para empezar/i)).toBeInTheDocument();
    expect(screen.getByTestId('my-progress-cta')).toHaveAttribute('href', '/session');
  });

  test('con sesiones y delta positivo, sin CTA', () => {
    renderCard({
      progress: {
        sessionsThisMonth: 2,
        sessionsLastMonth: 0,
        lastSessionDate: '2026-09-14',
        daysSinceLastSession: 3,
        consecutiveWeeksWithSession: 2,
      },
      totalTimings: 5,
    });

    expect(screen.getByTestId('my-progress-sessions')).toHaveTextContent('2');
    expect(screen.getByTestId('my-progress-delta')).toHaveTextContent('+2');
    expect(screen.getByTestId('my-progress-last')).toHaveTextContent('Última sesión hace 3 días');
    expect(screen.getByTestId('my-progress-streak')).toHaveTextContent(/2 semanas/);
    expect(screen.queryByTestId('my-progress-cta')).not.toBeInTheDocument();
  });

  test('cero este mes y delta negativo', () => {
    renderCard({
      progress: {
        sessionsThisMonth: 0,
        sessionsLastMonth: 1,
        lastSessionDate: '2026-08-20',
        daysSinceLastSession: 26,
        consecutiveWeeksWithSession: 1,
      },
      totalTimings: 4,
    });

    expect(screen.getByTestId('my-progress-sessions')).toHaveTextContent('0');
    expect(screen.getByTestId('my-progress-delta')).toHaveTextContent('−1');
    expect(screen.getByTestId('my-progress-cta')).toHaveAttribute('href', '/session');
    expect(screen.queryByTestId('my-progress-streak')).not.toBeInTheDocument();
  });

  test('no muestra CTA si el nudge de sesión ya está visible', () => {
    renderCard({
      progress: {
        sessionsThisMonth: 0,
        sessionsLastMonth: 0,
        lastSessionDate: null,
        daysSinceLastSession: null,
        consecutiveWeeksWithSession: 0,
      },
      totalTimings: 0,
      sessionNudgeVisible: true,
    });

    expect(screen.getByText(/tanda corta basta para empezar/i)).toBeInTheDocument();
    expect(screen.queryByTestId('my-progress-cta')).not.toBeInTheDocument();
  });

  test('delta igual', () => {
    renderCard({
      progress: {
        sessionsThisMonth: 1,
        sessionsLastMonth: 1,
        lastSessionDate: '2026-09-10',
        daysSinceLastSession: 7,
        consecutiveWeeksWithSession: 0,
      },
      totalTimings: 3,
    });

    expect(screen.getByTestId('my-progress-delta')).toHaveTextContent('Igual');
    expect(screen.queryByTestId('my-progress-cta')).not.toBeInTheDocument();
  });
});
