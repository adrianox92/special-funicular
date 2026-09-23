import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const map = {
        'standings.adjustPointsTitle': 'Ajustar puntos de la prueba',
        'standings.adjustPointsHelp': 'Ayuda ajuste',
        'standings.adjustPointsField': 'Puntos',
        'standings.adjustReason': 'Motivo',
        'standings.adjustReasonHint': 'Ej.',
        'standings.adjustSave': 'Guardar ajuste',
        'standings.adjustClear': 'Quitar ajuste',
        'standings.adjustedBy': `por ${opts?.name ?? ''}`,
        'standings.adjustedAuthorFallback': 'organizador',
      };
      return map[key] ?? key;
    },
  }),
}));

import LeaguePointsOverrideDialog from '../../components/league/LeaguePointsOverrideDialog';

describe('LeaguePointsOverrideDialog', () => {
  test('guarda puntos y motivo', () => {
    const onSave = jest.fn();
    render(
      <LeaguePointsOverrideDialog
        open
        onOpenChange={() => {}}
        target={{
          row: { name: 'Ana', league_participant_id: 'lp-1' },
          competitionName: 'Prueba 1',
          entry: { points: 10, overridden: false },
        }}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByTestId('league-override-points'), { target: { value: '18' } });
    fireEvent.change(screen.getByTestId('league-override-reason'), { target: { value: 'Acta' } });
    fireEvent.click(screen.getByTestId('league-override-save'));

    expect(onSave).toHaveBeenCalledWith({ points: 18, reason: 'Acta' });
  });

  test('muestra auditoría y permite quitar override', () => {
    const onClear = jest.fn();
    render(
      <LeaguePointsOverrideDialog
        open
        onOpenChange={() => {}}
        target={{
          row: { name: 'Ana', league_participant_id: 'lp-1' },
          competitionName: 'Prueba 1',
          entry: {
            points: 18,
            overridden: true,
            override: {
              points: 18,
              reason: 'Acta',
              updated_by_label: 'María',
              updated_at: '2026-01-02T10:00:00.000Z',
            },
          },
        }}
        onClear={onClear}
      />,
    );

    expect(screen.getByTestId('league-override-audit')).toHaveTextContent('María');
    expect(screen.getByTestId('league-override-audit')).toHaveTextContent('Acta');
    fireEvent.click(screen.getByTestId('league-override-clear'));
    expect(onClear).toHaveBeenCalled();
  });
});
