import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DevelopersPage from '../../pages/DevelopersPage';
import i18n from '../../i18n';
import {
  CONTACT_PATH,
  PARTNER_OPENAPI_PRODUCTION_URL,
  PARTNER_SWAGGER_PRODUCTION_URL,
} from '../../utils/partnerApiUrls';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../../components/Footer', () => () => <footer data-testid="footer" />);

const FORBIDDEN = /slot\s*lap\s*timer|slotlaptimer|lap\s*counter|ds-?200|ds200-manager|staging\.slotdatabase/i;

async function renderPage() {
  await i18n.loadNamespaces(['developers', 'common', 'meta']);
  await i18n.changeLanguage('es');
  return render(
    <MemoryRouter>
      <DevelopersPage />
    </MemoryRouter>,
  );
}

describe('DevelopersPage', () => {
  test('muestra marca, Swagger, OpenAPI, Perfil y contacto', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/integradores/i);
    });

    expect(screen.getAllByText('Slot Database API').length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/X-API-Key/);
    expect(document.body.textContent).toMatch(/vehicle_id/);

    const swagger = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === PARTNER_SWAGGER_PRODUCTION_URL);
    expect(swagger.length).toBeGreaterThan(0);

    const openapi = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === PARTNER_OPENAPI_PRODUCTION_URL);
    expect(openapi.length).toBeGreaterThan(0);

    expect(screen.getByRole('link', { name: /obtener api key/i })).toHaveAttribute('href', expect.stringContaining('/login'));
    expect(screen.getByRole('link', { name: /formulario de contacto/i })).toHaveAttribute('href', CONTACT_PATH);

    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });

  test('cambia a inglés con i18n', async () => {
    await i18n.loadNamespaces(['developers', 'common']);
    await i18n.changeLanguage('en');
    render(
      <MemoryRouter>
        <DevelopersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Documentation for integrators/i);
    });
    expect(document.body.textContent).not.toMatch(FORBIDDEN);
  });
});
