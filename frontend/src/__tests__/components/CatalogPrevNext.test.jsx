import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CatalogPrevNext from '../../components/CatalogPrevNext';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const map = { previous: 'Anterior', next: 'Siguiente' };
      return map[key] ?? key;
    },
    i18n: { language: 'es', changeLanguage: jest.fn() },
  }),
}));

const prev = {
  id: '11111111-1111-4111-8111-111111111111',
  manufacturer: 'Ninco',
  reference: 'A1',
  model_name: 'GT 1',
};
const next = {
  id: '22222222-2222-4222-8222-222222222222',
  manufacturer: 'Ninco',
  reference: 'A2',
  model_name: 'GT 2',
};

describe('CatalogPrevNext', () => {
  test('pinta enlaces reales a fichas vecinas', () => {
    render(
      <MemoryRouter>
        <CatalogPrevNext neighbors={{ prev, next }} />
      </MemoryRouter>,
    );
    const prevLink = screen.getByRole('link', { name: /Anterior/i });
    const nextLink = screen.getByRole('link', { name: /Siguiente/i });
    expect(prevLink).toHaveAttribute(
      'href',
      `/catalogo/${prev.id}/gt-1`,
    );
    expect(nextLink).toHaveAttribute(
      'href',
      `/catalogo/${next.id}/gt-2`,
    );
  });

  test('omite el lado vacío', () => {
    render(
      <MemoryRouter>
        <CatalogPrevNext neighbors={{ prev: null, next }} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: /Anterior/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Siguiente/i })).toBeInTheDocument();
  });
});
