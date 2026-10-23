import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockEmblaCalls = [];

jest.mock('embla-carousel-react', () => ({
  __esModule: true,
  default: (opts) => {
    mockEmblaCalls.push(opts);
    return [
      () => {},
      {
        canScrollPrev: () => false,
        canScrollNext: () => true,
        scrollPrev: jest.fn(),
        scrollNext: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
      },
    ];
  },
}));

jest.mock('../../hooks/useLocale', () => ({
  useLocale: () => ({ locale: 'es' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) =>
      ({
        'detail.similarTitle': 'Vehículos similares',
        'detail.similarAria': 'Carrusel de vehículos similares',
        'list.noImage': 'Sin imagen',
        'list.badgeDiscontinued': 'Descatalogado',
        'list.badgeUpcoming': 'Próximo lanzamiento',
      })[key] ?? key,
  }),
}));

import CatalogSimilarVehicles from '../../components/CatalogSimilarVehicles';

function row(n, extra = {}) {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    reference: `R${n}`,
    manufacturer: n === 1 ? 'Ninco' : 'Scalextric',
    model_name: 'Porsche 911 GT3',
    vehicle_type: 'GT',
    image_url: `https://cdn.example/${n}.jpg`,
    rating_avg: 4.2,
    rating_count: 3,
    ...extra,
  };
}

function installMatchMedia(matches) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

function renderBlock(items) {
  return render(
    <MemoryRouter>
      <CatalogSimilarVehicles items={items} />
    </MemoryRouter>,
  );
}

describe('CatalogSimilarVehicles', () => {
  beforeEach(() => {
    mockEmblaCalls.length = 0;
    installMatchMedia(true);
  });

  test('no pinta la sección con 0 o 1 ítem', () => {
    const { rerender } = renderBlock([]);
    expect(screen.queryByRole('heading', { name: 'Vehículos similares' })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <CatalogSimilarVehicles items={[row(1)]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading', { name: 'Vehículos similares' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-similar-grid')).not.toBeInTheDocument();
  });

  test('en escritorio muestra una fila y no el carrusel', () => {
    installMatchMedia(true);
    renderBlock([row(1), row(2), row(3)]);
    const grid = screen.getByTestId('catalog-similar-grid');
    expect(grid).toHaveClass('grid-cols-3');
    expect(screen.getAllByRole('link')).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Carrusel de vehículos similares' })).not.toBeInTheDocument();
    expect(mockEmblaCalls).toHaveLength(0);

    const link = screen.getByRole('link', { name: /R1/ });
    expect(link).toHaveAttribute(
      'href',
      '/catalogo/00000000-0000-4000-8000-000000000001/porsche-911-gt3',
    );
    expect(link).toHaveTextContent('Ninco');
    expect(link).toHaveTextContent('Porsche 911 GT3');
    const img = screen.getByRole('img', { name: /Coche slot, Ninco, ref\. R1, Porsche 911 GT3/ });
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  test('ajusta las columnas a 2 y a 4', () => {
    const { rerender } = renderBlock([row(1), row(2)]);
    expect(screen.getByTestId('catalog-similar-grid')).toHaveClass('grid-cols-2');

    rerender(
      <MemoryRouter>
        <CatalogSimilarVehicles items={[row(1), row(2), row(3), row(4)]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('catalog-similar-grid')).toHaveClass('grid-cols-4');
  });

  test('en móvil muestra un carrusel sin loop y flechas dentro del bloque', () => {
    installMatchMedia(false);
    renderBlock([row(1), row(2)]);

    expect(screen.queryByTestId('catalog-similar-grid')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Carrusel de vehículos similares' })).toBeInTheDocument();
    expect(mockEmblaCalls.at(-1)).toEqual(expect.objectContaining({ loop: false }));

    const prev = screen.getByRole('button', { name: /previous slide/i });
    const next = screen.getByRole('button', { name: /next slide/i });
    expect(prev.className).toContain('left-2');
    expect(prev.className).not.toContain('-left-12');
    expect(next.className).toContain('right-2');
    expect(next.className).not.toContain('-right-12');

    expect(screen.getByRole('link', { name: /R2/ })).toHaveAttribute(
      'href',
      '/catalogo/00000000-0000-4000-8000-000000000002/porsche-911-gt3',
    );
  });
});
