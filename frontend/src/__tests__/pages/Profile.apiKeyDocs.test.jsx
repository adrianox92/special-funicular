import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../../pages/Profile';
import api from '../../lib/axios';
import { PARTNER_SWAGGER_PRODUCTION_URL } from '../../utils/partnerApiUrls';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'piloto@example.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('../../lib/licenseAdmin', () => ({
  isLicenseAdminUser: () => false,
}));

describe('Profile API key docs links', () => {
  beforeEach(() => {
    api.get.mockImplementation((url) => {
      if (url === '/api-keys/me') {
        return Promise.resolve({
          data: { api_key: null, key_exists: false, message: null, created_at: null },
        });
      }
      if (url === '/pilot-profile') {
        return Promise.resolve({ data: { slug: '', display_name: '', enabled: false } });
      }
      if (url === '/license-account/me') {
        return Promise.resolve({ data: { is_paid: false } });
      }
      return Promise.reject(new Error(`unexpected GET ${url}`));
    });
  });

  test('la sección API Key enlaza a Developers y Swagger', async () => {
    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('API Key de integración')).toBeInTheDocument();
    });

    const developers = screen.getByRole('link', { name: /documentación para integradores/i });
    expect(developers).toHaveAttribute('href', '/developers');

    const swagger = screen.getByRole('link', { name: /swagger/i });
    expect(swagger).toHaveAttribute('href', PARTNER_SWAGGER_PRODUCTION_URL);
    expect(swagger).toHaveAttribute('target', '_blank');
  });
});
