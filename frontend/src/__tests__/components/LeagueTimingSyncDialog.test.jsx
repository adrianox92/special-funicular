import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockT = (key, opts) => {
  const map = {
    'timingSync.title': 'Crear resultado desde sesión de timing',
    'timingSync.subtitle': 'Copia sesiones',
    'timingSync.subtitleNamed': `Copia sesiones de ${opts?.name ?? ''}`,
    'timingSync.summary': `${opts?.matched ?? 0} emparejados · ${opts?.unmatched ?? 0} sin match · ${opts?.skipped ?? 0} override`,
    'timingSync.roundsCount': `${opts?.count ?? 0} ronda(s)`,
    'timingSync.overrideKept': 'override intacto',
    'timingSync.unmatchedPilots': `Sin sesión: ${opts?.names ?? ''}`,
    'timingSync.dnsRule': 'El sync no inventa DNS',
    'timingSync.emptyVehicles': 'No hay vehículos',
    'timingSync.emptySessions': 'No hay sesiones',
    'timingSync.emptyMatches': 'Sin coincidencias',
    'timingSync.errorTitle': 'Error',
    'timingSync.loadError': 'Error al cargar',
    'timingSync.applyError': 'Error al aplicar',
    'timingSync.cancel': 'Cancelar',
    'timingSync.apply': 'Aplicar a la prueba',
  };
  return map[key] ?? key;
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import axios from '../../lib/axios';
import LeagueTimingSyncDialog from '../../components/league/LeagueTimingSyncDialog';

const preview = {
  matched_count: 1,
  unmatched_session_count: 1,
  unmatched_participant_count: 1,
  skipped_override_count: 1,
  empty_reason: null,
  matched: [
    {
      name: 'Ana',
      league_participant_id: 'lp-1',
      has_override: true,
      rounds: [{ session_id: 's1', round_number: 1 }],
    },
  ],
  unmatched_participants: [{ name: 'Luis', league_participant_id: 'lp-2' }],
};

describe('LeagueTimingSyncDialog', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
  });

  test('muestra preview con matches, override y empty de sesiones', async () => {
    axios.get.mockResolvedValue({ data: preview });

    render(
      <LeagueTimingSyncDialog
        open
        onOpenChange={() => {}}
        leagueId="lg-1"
        competitionId="comp-1"
        competitionName="Ronda 1"
      />,
    );

    expect(await screen.findByTestId('league-timing-sync-summary')).toHaveTextContent('1 emparejados');
    expect(await screen.findByTestId('league-timing-sync-matched')).toHaveTextContent('Ana');
    expect(screen.getByTestId('league-timing-sync-matched')).toHaveTextContent('override intacto');
    expect(screen.getByTestId('league-timing-sync-unmatched-pilots')).toHaveTextContent('Luis');
    expect(screen.getByTestId('league-timing-sync-dns-rule')).toHaveTextContent('no inventa DNS');
    expect(screen.getByTestId('league-timing-sync-apply')).toBeEnabled();
  });

  test('empty state si no hay sesiones', async () => {
    axios.get.mockResolvedValue({
      data: { ...preview, matched_count: 0, matched: [], empty_reason: 'no_sessions' },
    });

    render(
      <LeagueTimingSyncDialog
        open
        onOpenChange={() => {}}
        leagueId="lg-1"
        competitionId="comp-1"
      />,
    );

    expect(await screen.findByTestId('league-timing-sync-empty-sessions')).toHaveTextContent('No hay sesiones');
    expect(screen.getByTestId('league-timing-sync-apply')).toBeDisabled();
  });

  test('aplica el sync y notifica el resultado', async () => {
    axios.get.mockResolvedValue({ data: preview });
    axios.post.mockResolvedValue({ data: { ...preview, applied: true } });
    const onApplied = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <LeagueTimingSyncDialog
        open
        onOpenChange={onOpenChange}
        leagueId="lg-1"
        competitionId="comp-1"
        onApplied={onApplied}
      />,
    );

    const apply = await screen.findByTestId('league-timing-sync-apply');
    await waitFor(() => expect(apply).toBeEnabled());
    fireEvent.click(apply);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/leagues/lg-1/competitions/comp-1/timing-sync');
      expect(onApplied).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  test('muestra error de carga', async () => {
    axios.get.mockRejectedValue({ response: { data: { error: 'Sin permiso' } } });

    render(
      <LeagueTimingSyncDialog
        open
        onOpenChange={() => {}}
        leagueId="lg-1"
        competitionId="comp-1"
      />,
    );

    expect(await screen.findByTestId('league-timing-sync-error')).toHaveTextContent('Sin permiso');
  });
});
