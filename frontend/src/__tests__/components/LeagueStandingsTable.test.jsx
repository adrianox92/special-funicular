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
        'standings.helpOverride': 'Override',
        'standings.countingSummary': `Cuentan ${opts?.count ?? ''}`,
        'standings.empty': 'Aún no hay clasificación.',
        'standings.emptyNoEvents': 'Esta liga aún no tiene pruebas enlazadas.',
        'standings.emptyNoEventsHint': 'Sin pruebas no hay columnas.',
        'standings.emptyNoResults': 'Hay pruebas, pero todavía no alimentan la clasificación.',
        'standings.emptyNoResultsHint': 'Cerrada siempre cuenta.',
        'standings.emptyNoParticipants': 'No hay pilotos con fila.',
        'standings.emptyNoParticipantsHint': 'Inscribe participantes.',
        'standings.emptyCountingUnset': 'No hay descartes configurados.',
        'standings.emptyCountingUnsetOrganizer': 'Configura pruebas que cuentan.',
        'standings.countingUnsetBadge': 'Sin descartes',
        'rules.open': 'Cómo se calcula',
        'rules.openSettings': 'Reglas de clasificación',
        'rules.title': 'Reglas de la liga',
        'rules.subtitle.standings': 'Descartes y DNS',
        'rules.drops.title': 'Descartes',
        'rules.drops.counting': `Cuentan ${opts?.count ?? ''}`,
        'rules.drops.unset': 'Sin descartes',
        'rules.drops.meaning': 'Descartada no suma',
        'rules.dns.title': 'DNS',
        'rules.dns.body': '0 pts y ocupa descarte',
        'rules.absent.title': 'No figura',
        'rules.absent.body': 'Celda — no consume descarte',
        'rules.dnf.title': 'DNF',
        'rules.dnf.body': 'Puntos del resultado',
        'rules.dsq.title': 'DSQ',
        'rules.dsq.body': 'Igual que DNS',
        'rules.tiebreak.title': 'Empates',
        'rules.tiebreak.intro': 'Puntos primero',
        'rules.tiebreak.current': `Modo ${opts?.mode ?? ''}`,
        'rules.tiebreak.labels.competitions_completed': 'Más pruebas',
        'rules.tiebreak.labels.most_wins': 'Más victorias',
        'rules.tiebreak.labels.last_race_position': 'Última prueba',
        'rules.tiebreak.modes.competitions_completed': 'más filas con puntos',
        'rules.tiebreak.modes.most_wins': 'más primeros',
        'rules.tiebreak.modes.last_race_position': 'mejor puesto última',
        'rules.tiebreak.fallback': 'Por nombre',
        'rules.override.title': 'Ajustado',
        'rules.override.body': 'Override manual',
        'rules.override.priority': 'override > DNS/DSQ > calculated',
        'rules.scoringEvents.title': 'Qué pruebas alimentan',
        'rules.scoringEvents.closed': 'Cerrada siempre',
        'rules.scoringEvents.runningPublished': 'En curso o publicada con tiempos',
        'rules.scoringEvents.other': 'Borrador no entra',
        'standings.pos': 'Pos',
        'standings.driver': 'Piloto',
        'standings.total': 'Total',
        'standings.openSeasonHint': 'Abre la ficha',
        'standings.adjustPoints': 'Ajustar puntos',
        'standings.adjustPointsTitle': 'Ajustar puntos de la prueba',
        'standings.adjustPointsHelp': 'Ayuda ajuste',
        'standings.adjustPointsField': 'Puntos',
        'standings.adjustReason': 'Motivo',
        'standings.adjustReasonHint': 'Ej.',
        'standings.adjustSave': 'Guardar ajuste',
        'standings.adjustClear': 'Quitar ajuste',
        'standings.adjustedBadge': 'Ajustado',
        'standings.adjustedBy': `por ${opts?.name ?? ''}`,
        'standings.adjustedAuthorFallback': 'organizador',
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
        'mySeason.helpOverride': 'Ajustado sustituye',
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
  default: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
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
      c1: {
        points: 22,
        position: 1,
        dropped: false,
        overridden: true,
        override: { points: 22, reason: 'Acta' },
      },
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

  test('muestra badge de puntos ajustados en la celda', () => {
    renderTable();
    expect(screen.getAllByTestId('league-adjusted-badge')[0]).toHaveTextContent('Ajustado');
    expect(screen.getAllByTestId('league-adjusted-badge')[0]).toHaveAttribute('title', expect.stringContaining('Acta'));
  });

  test('empty state sin pruebas', () => {
    render(
      <MemoryRouter>
        <LeagueStandingsTable standings={[]} competitions={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('league-standings-empty')).toHaveTextContent(
      'Esta liga aún no tiene pruebas enlazadas.',
    );
    expect(screen.queryByTestId('league-my-season-cta')).not.toBeInTheDocument();
  });

  test('empty state sin resultados publicados', () => {
    render(
      <MemoryRouter>
        <LeagueStandingsTable
          standings={[]}
          competitions={[
            {
              competition_id: 'c-draft',
              competition_name: 'Borrador',
              competition_status: 'published',
              has_results: false,
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('league-standings-empty')).toHaveTextContent(
      'Hay pruebas, pero todavía no alimentan la clasificación.',
    );
  });

  test('abre el panel de reglas con DNS y Ajustado', () => {
    renderTable({ tiebreakMode: 'most_wins' });
    fireEvent.click(screen.getAllByTestId('league-rules-help-trigger')[0]);
    const panel = screen.getByTestId('league-rules-help');
    expect(panel).toHaveTextContent('0 pts y ocupa descarte');
    expect(panel).toHaveTextContent('Celda — no consume descarte');
    expect(panel).toHaveTextContent('override > DNS/DSQ > calculated');
    expect(panel).toHaveTextContent('Cerrada siempre');
  });
});
