import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const map = {
        'calendar.title': 'Calendario de temporada',
        'calendar.subtitle': 'Próximas y disputadas',
        'calendar.filterLabel': 'Filtrar',
        'calendar.filter.all': 'Todas',
        'calendar.filter.upcoming': 'Próximas',
        'calendar.filter.running': 'En curso',
        'calendar.filter.completed': 'Disputadas',
        'calendar.section.upcoming': 'Próximas',
        'calendar.section.running': 'En curso',
        'calendar.section.completed': 'Disputadas',
        'calendar.phase.upcoming': 'Próxima',
        'calendar.phase.running': 'En curso',
        'calendar.phase.completed': 'Disputada',
        'calendar.empty': 'No hay pruebas enlazadas en esta liga.',
        'calendar.emptyPublic': 'No hay pruebas públicas',
        'calendar.noDate': 'Sin fecha',
        'calendar.noDatesHint': 'Ninguna prueba tiene fecha',
        'calendar.orderIndex': `Prueba ${opts?.n ?? ''}`,
        'calendar.signup': 'Inscribirse',
        'calendar.publicStatus': 'Estado público',
        'calendar.manage': 'Gestionar',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('../../utils/formatUtils', () => ({
  getIntlLocale: () => 'es-ES',
}));

import LeagueSeasonCalendar from '../../components/league/LeagueSeasonCalendar';

function renderCal(props) {
  return render(
    <MemoryRouter>
      <LeagueSeasonCalendar {...props} />
    </MemoryRouter>,
  );
}

describe('LeagueSeasonCalendar', () => {
  test('empty state sin pruebas', () => {
    renderCal({ competitions: [], variant: 'organizer' });
    expect(screen.getByText('No hay pruebas enlazadas en esta liga.')).toBeInTheDocument();
  });

  test('secciones próximas y disputadas con y sin fecha', () => {
    renderCal({
      variant: 'organizer',
      competitions: [
        { id: '1', name: 'GP Invierno', status: 'published', order_index: 0, event_date: null },
        { id: '2', name: 'GP Primavera', status: 'closed', order_index: 1, event_date: '2026-03-15' },
        { id: '3', name: 'GP Verano', status: 'running', order_index: 2, event_date: '2026-07-01' },
      ],
    });
    expect(screen.getByText('GP Invierno')).toBeInTheDocument();
    expect(screen.getByText('GP Primavera')).toBeInTheDocument();
    expect(screen.getByText('GP Verano')).toBeInTheDocument();
    expect(screen.getByText('Sin fecha')).toBeInTheDocument();
    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Próximas/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Disputadas/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /En curso/ })).toBeInTheDocument();
  });

  test('público oculta borradores y enlaza inscripción', () => {
    renderCal({
      variant: 'public',
      competitions: [
        { id: 'd', name: 'Borrador oculto', status: 'draft', order_index: 0, public_slug: 'draft-x' },
        {
          id: 'p',
          name: 'Prueba pública',
          status: 'published',
          order_index: 1,
          public_slug: 'gp-pub',
          event_date: '2026-04-01',
        },
      ],
    });
    expect(screen.queryByText('Borrador oculto')).not.toBeInTheDocument();
    const signup = screen.getByRole('link', { name: /Inscribirse/i });
    expect(signup).toHaveAttribute('href', '/competitions/signup/gp-pub');
  });
});
