import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = {
        home: 'Inicio',
        vehicles: 'Vehículos',
        newSession: 'Nueva sesión',
        timings: 'Tiempos',
        timingsList: 'Historial',
        circuits: 'Circuitos',
        inventory: 'Inventario',
        competitions: 'Competiciones',
        myCompetitions: 'Mis competiciones',
        leagues: 'Ligas',
        favoritePilots: 'Pilotos favoritos',
        clubs: 'Clubes',
        help: 'Ayuda',
        openMenu: 'Abrir menú',
        menu: 'Menú',
        'search.aria': 'Abrir búsqueda rápida',
        'search.placeholder': 'Buscar',
        toggleTheme: 'Cambiar tema',
        user: 'Usuario',
        myProfile: 'Mi Perfil',
        changelog: 'Novedades',
        settings: 'Configuración',
        logout: 'Cerrar Sesión',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'pilot@example.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));

jest.mock('../../context/CommandPaletteContext', () => ({
  useCommandPalette: () => ({ setOpen: jest.fn() }),
}));

jest.mock('../../lib/licenseAdmin', () => ({
  isLicenseAdminUser: () => false,
}));

jest.mock('../../lib/sellerProfileCache', () => ({
  getCachedSellerProfile: () => false,
  setCachedSellerProfile: jest.fn(),
  invalidateSellerProfileCache: jest.fn(),
}));

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../components/LanguageSelector', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../components/ChangelogBell', () => ({
  ChangelogBell: () => null,
}));

import Navbar from '../../components/Navbar';

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
}

describe('Navbar — grupo Tiempos', () => {
  test('desktop: Tiempos es un menú y ya no hay enlace top-level a Nueva sesión', () => {
    renderNavbar();

    expect(screen.queryByRole('link', { name: 'Nueva sesión' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiempos' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  test('móvil: hoja con padre a /timings e hijos indentados (Nueva sesión, Historial)', async () => {
    renderNavbar();

    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    const dialog = await screen.findByRole('dialog');
    const parent = within(dialog).getByRole('link', { name: 'Tiempos' });
    expect(parent).toHaveAttribute('href', '/timings');

    const sessionLink = within(dialog).getByRole('link', { name: 'Nueva sesión' });
    const historyLink = within(dialog).getByRole('link', { name: 'Historial' });
    expect(sessionLink).toHaveAttribute('href', '/session');
    expect(historyLink).toHaveAttribute('href', '/timings');

    const childLinks = within(sessionLink.parentElement).getAllByRole('link');
    expect(childLinks[0]).toHaveAttribute('href', '/session');
    expect(childLinks[1]).toHaveAttribute('href', '/timings');
  });
});
