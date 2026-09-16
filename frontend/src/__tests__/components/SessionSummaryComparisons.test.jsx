import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionSummaryComparisons from '../../components/SessionSummaryComparisons';
import { buildSessionSummaryComparisons } from '../../utils/sessionSummaryComparisons';
import i18n from '../../i18n';

const current = {
  id: 't-now',
  circuit_id: 'cir-1',
  lane: '1',
  best_lap_time: '00:11.324',
  best_lap_timestamp: 11.324,
  timing_date: '2026-09-16',
  session_type: 'TRAINING',
};

describe('SessionSummaryComparisons', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es');
    await i18n.loadNamespaces('session');
  });

  test('empty state de circuito si no hay historial', () => {
    const comparisons = buildSessionSummaryComparisons({ current, history: [] });
    render(<SessionSummaryComparisons comparisons={comparisons} />);

    expect(screen.getByTestId('session-summary-circuit-pb')).toHaveTextContent(
      /Primera sesión en este circuito|First session on this circuit|Erste Session auf dieser Strecke/,
    );
    expect(screen.queryByTestId('session-summary-month-pb')).not.toBeInTheDocument();
    expect(screen.getByText(/Nuevo récord personal|New personal best|Neue persönliche Bestzeit/)).toBeInTheDocument();
  });

  test('muestra PB de circuito, 30 días, sesión anterior y deltas más rápido/lento', () => {
    const comparisons = buildSessionSummaryComparisons({
      current,
      history: [
        {
          id: 't-circuit',
          circuit_id: 'cir-1',
          lane: '2',
          best_lap_timestamp: 11.2,
          timing_date: '2026-06-01',
          created_at: '2026-06-01T10:00:00.000Z',
        },
        {
          id: 't-month',
          circuit_id: 'cir-1',
          lane: '1',
          best_lap_timestamp: 11.5,
          timing_date: '2026-09-10',
          created_at: '2026-09-10T10:00:00.000Z',
        },
      ],
      now: new Date('2026-09-16T15:00:00'),
    });
    render(<SessionSummaryComparisons comparisons={comparisons} />);

    const circuit = screen.getByTestId('session-summary-circuit-pb');
    expect(circuit).toHaveTextContent(/00:11\.200/);
    expect(circuit).toHaveTextContent(/más lento|slower|langsamer/);

    const month = screen.getByTestId('session-summary-month-pb');
    expect(month).toHaveTextContent(/00:11\.500/);
    expect(month).toHaveTextContent(/más rápido|faster|schneller/);

    expect(screen.getByTestId('session-summary-last')).toHaveTextContent(/00:11\.500/);
    expect(screen.getByTestId('session-summary-lane-pb')).toHaveTextContent(/00:11\.500/);
    expect(screen.getByText(/Mejor del mes|Best of the month|Monatsbestzeit/)).toBeInTheDocument();
  });

  test('muestra consistencia y peor vuelta si vienen en la sesión guardada', () => {
    const comparisons = buildSessionSummaryComparisons({
      current: { ...current, consistency_score: 4.2, worst_lap_timestamp: 12.1 },
      history: [],
    });
    render(<SessionSummaryComparisons comparisons={comparisons} />);

    expect(screen.getByTestId('session-summary-consistency')).toHaveTextContent('4.20%');
    expect(screen.getByTestId('session-summary-worst')).toHaveTextContent(/00:12\.100/);
  });
});
