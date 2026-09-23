import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const map = {
        'mySeason.kicker': 'Liga',
        'mySeason.titleSelf': 'Mi temporada',
        'mySeason.titleOther': `Temporada de ${opts?.name ?? ''}`,
        'mySeason.titleFallback': 'Temporada del piloto',
        'mySeason.position': 'Posición actual',
        'mySeason.points': 'Puntos',
        'mySeason.pointsHint': 'Tras descartes',
        'mySeason.pointsValue': `${opts?.points ?? ''} pts`,
        'mySeason.place': `${opts?.n ?? ''}º`,
        'mySeason.noPoints': 'Sin puntos',
        'mySeason.helpTitle': 'Cómo leer esta ficha',
        'mySeason.helpCounting': `Cuentan las ${opts?.count ?? ''} mejores`,
        'mySeason.helpCountingUnset': 'Todas cuentan',
        'mySeason.helpDnsVsAbsent': 'DNS vs no figura',
        'mySeason.helpOverride': 'Ajustado sustituye',
        'standings.adjustedBadge': 'Ajustado',
        'standings.adjustedBy': `por ${opts?.name ?? ''}`,
        'mySeason.racesTitle': 'Desglose por prueba',
        'mySeason.droppedTitle': 'Pruebas descartadas',
        'mySeason.countingTitle': 'Pruebas que cuentan',
        'mySeason.droppedEmpty': 'Ninguna prueba descartada todavía.',
        'mySeason.droppedBadge': 'Descarte',
        'mySeason.countsBadge': 'Cuenta',
        'mySeason.appearance.result': 'Resultado',
        'mySeason.appearance.dns': 'DNS',
        'mySeason.appearance.dsq': 'DSQ',
        'mySeason.appearance.absent': 'No figura',
        'mySeason.appearance.pending': 'Pendiente',
        'mySeason.emptyNoCompetitions': 'Esta liga aún no tiene pruebas enlazadas.',
        'mySeason.emptyNoResults': 'Este piloto todavía no tiene resultados en la liga.',
        'mySeason.emptyNotFound': 'No se encontró a este participante en la liga.',
        'mySeason.openRace': 'Ver inscripción de la prueba',
      };
      return map[key] ?? key;
    },
  }),
}));

import LeagueMySeason from '../../components/league/LeagueMySeason';

function renderSeason(season) {
  return render(
    <MemoryRouter>
      <LeagueMySeason season={season} />
    </MemoryRouter>,
  );
}

describe('LeagueMySeason', () => {
  test('empty: piloto no encontrado', () => {
    renderSeason({ found: false, empty_reason: 'not_found', races: [] });
    expect(screen.getByTestId('league-my-season-empty')).toHaveTextContent(
      'No se encontró a este participante en la liga.',
    );
  });

  test('empty: liga sin pruebas', () => {
    renderSeason({
      found: true,
      is_self: true,
      participant: { name: 'Ana' },
      position: 1,
      total_points: 0,
      counting_races: 3,
      races: [],
      counting: [],
      dropped: [],
      empty_reason: 'no_competitions',
      league: { name: 'Liga Vacía' },
    });
    expect(screen.getByTestId('league-my-season-no-races')).toHaveTextContent(
      'Esta liga aún no tiene pruebas enlazadas.',
    );
  });

  test('lista descartes, DNS y no figura', () => {
    renderSeason({
      found: true,
      is_self: true,
      participant: { name: 'Ana' },
      position: 2,
      total_points: 43,
      counting_races: 2,
      empty_reason: null,
      league: { name: 'Liga Invierno' },
      counting: [
        { competition_id: 'c1', competition_name: 'Prueba 1', points: 25, appearance: 'result' },
      ],
      dropped: [
        {
          competition_id: 'c3',
          competition_name: 'Prueba 3',
          points: 0,
          appearance: 'dns',
          dropped: true,
        },
      ],
      races: [
        {
          competition_id: 'c1',
          competition_name: 'Prueba 1',
          points: 25,
          position: 1,
          appearance: 'result',
          counts: true,
          dropped: false,
          public_path: '/competitions/signup/p1',
          overridden: true,
          override: { points: 25, reason: 'Acta' },
        },
        {
          competition_id: 'c3',
          competition_name: 'Prueba 3',
          points: 0,
          appearance: 'dns',
          counts: false,
          dropped: true,
        },
        {
          competition_id: 'c4',
          competition_name: 'Prueba 4',
          points: null,
          appearance: 'absent',
          counts: false,
          dropped: false,
        },
      ],
    });

    expect(screen.getByTestId('league-my-season')).toHaveTextContent('Mi temporada');
    expect(screen.getByTestId('league-my-season-position')).toHaveTextContent('2');
    expect(screen.getByTestId('league-my-season-points')).toHaveTextContent('43');
    expect(screen.getByTestId('league-my-season-dropped')).toHaveTextContent('Prueba 3');
    expect(screen.getByTestId('league-my-season-dropped')).toHaveTextContent('DNS');
    expect(screen.getByTestId('league-my-season-races')).toHaveTextContent('No figura');
    expect(screen.getAllByTestId('league-adjusted-badge')[0]).toHaveTextContent('Ajustado');
    expect(screen.getByRole('link', { name: /Ver inscripción/i })).toHaveAttribute(
      'href',
      '/competitions/signup/p1',
    );
  });
});
