import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const map = {
        'standings.title': 'Clasificación general',
        'standings.helpTitle': 'Ayuda',
        'standings.helpDns': 'DNS',
        'standings.helpDsq': 'DSQ',
        'standings.helpAbsent': 'Ausente',
        'standings.helpCounting': `Cuentan ${opts?.count ?? ''}`,
        'standings.helpCountingUnset': 'Todas',
        'standings.countingSummary': `Cuentan ${opts?.count ?? ''}`,
        'standings.empty': 'Aún no hay clasificación.',
        'standings.pos': 'Pos',
        'standings.driver': 'Piloto',
        'standings.total': 'Total',
        'standings.openSeasonHint': 'Abre la ficha',
        'mySeason.cta': 'Mi temporada',
        'mySeason.titleSelf': 'Mi temporada',
        'mySeason.titleOther': `Temporada de ${opts?.name ?? ''}`,
        'mySeason.titleFallback': 'Temporada del piloto',
        'mySeason.kicker': 'Liga',
        'mySeason.position': 'Posición actual',
        'mySeason.points': 'Puntos',
        'mySeason.pointsHint': 'Tras descartes',
        'mySeason.pointsValue': `${opts?.points ?? ''} pts`,
        'mySeason.place': `${opts?.n ?? ''}º`,
        'mySeason.noPoints': 'Sin puntos',
        'mySeason.helpTitle': 'Cómo leer',
        'mySeason.helpCounting': `Cuentan ${opts?.count ?? ''}`,
        'mySeason.helpCountingUnset': 'Todas',
        'mySeason.helpDnsVsAbsent': 'DNS vs no figura',
        'mySeason.racesTitle': 'Desglose',
        'mySeason.droppedTitle': 'Descartadas',
        'mySeason.countingTitle': 'Cuentan',
        'mySeason.droppedEmpty': 'Ninguna',
        'mySeason.droppedBadge': 'Descarte',
        'mySeason.countsBadge': 'Cuenta',
        'mySeason.appearance.result': 'Resultado',
        'mySeason.appearance.dns': 'DNS',
        'mySeason.appearance.dsq': 'DSQ',
        'mySeason.appearance.absent': 'No figura',
        'mySeason.appearance.pending': 'Pendiente',
        'mySeason.emptyNoCompetitions': 'Sin pruebas',
        'mySeason.emptyNoResults': 'Sin resultados',
        'mySeason.emptyNotFound': 'No encontrado',
        'mySeason.openRace': 'Ver prueba',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}));

import LeagueStandingsTable from '../../components/league/LeagueStandingsTable';

const competitions = [
  {
    competition_id: 'c1',
    competition_name: 'Prueba 1',
    competition_status: 'closed',
    has_results: true,
    public_slug: 'p1',
  },
  {
    competition_id: 'c2',
    competition_name: 'Prueba 2',
    competition_status: 'closed',
    has_results: true,
    public_slug: 'p2',
  },
];

const standings = [
  {
    league_participant_id: 'lp-1',
    name: 'Ana Pérez',
    email: 'ana@test.com',
    position: 1,
    total_points: 25,
    by_competition: {
      c1: { points: 25, position: 1, dropped: false },
      c2: { points: 0, position: null, dropped: true, result_status: 'dns' },
    },
  },
];

function renderTable(props = {}) {
  return render(
    <MemoryRouter>
      <LeagueStandingsTable
        standings={standings}
        competitions={competitions}
        countingRaces={1}
        leagueName="Liga Invierno"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('LeagueStandingsTable — Mi temporada', () => {
  test('click en piloto abre la ficha con descarte DNS', () => {
    renderTable();
    fireEvent.click(screen.getByTestId('league-standings-driver'));
    expect(screen.getByTestId('league-my-season')).toBeInTheDocument();
    expect(screen.getByTestId('league-my-season-dropped')).toHaveTextContent('Prueba 2');
    expect(screen.getByTestId('league-my-season-dropped')).toHaveTextContent('DNS');
  });

  test('CTA Mi temporada si el visitante coincide por email', () => {
    renderTable({ viewer: { email: 'ana@test.com' } });
    expect(screen.getByTestId('league-my-season-cta')).toBeInTheDocument();
  });

  test('empty state de clasificación', () => {
    render(
      <MemoryRouter>
        <LeagueStandingsTable standings={[]} competitions={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Aún no hay clasificación.')).toBeInTheDocument();
    expect(screen.queryByTestId('league-my-season-cta')).not.toBeInTheDocument();
  });
});
