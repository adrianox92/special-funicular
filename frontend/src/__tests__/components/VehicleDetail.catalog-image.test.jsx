import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import VehicleDetail from '../../components/VehicleDetail';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), delete: jest.fn() },
}));

jest.mock('../../components/CatalogTechSpecsSection', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: 'v1' }),
}));

const CATALOG = 'https://abcd.supabase.co/storage/v1/object/public/catalog-images/catalog/c1234.webp';
const OWN = 'https://abcd.supabase.co/storage/v1/object/public/vehicle-images/vehicles/v1/front.webp';

function renderDetail() {
  return render(<VehicleDetail />);
}

function mockVehicle({ imageUrl, images }) {
  api.get.mockImplementation((url) => {
    if (url === '/vehicles/v1') {
      return Promise.resolve({
        data: {
          id: 'v1',
          model: 'Porsche 911',
          manufacturer: 'Scalextric',
          catalog_item: imageUrl ? { image_url: imageUrl, limited_edition_total: null } : null,
        },
      });
    }
    if (url === '/vehicles/v1/images') {
      return Promise.resolve({ data: images });
    }
    if (url === '/vehicles/v1/technical-specs') {
      return Promise.resolve({ data: [] });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

describe('VehicleDetail foto de catálogo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  test('muestra la foto del catálogo en la vista frontal y no ofrece borrarla', async () => {
    mockVehicle({ imageUrl: CATALOG, images: [] });
    renderDetail();

    const img = await screen.findByAltText('Delantera');
    expect(img.getAttribute('src')).toContain('c1234.webp');
    expect(img.parentElement.querySelector('button')).toBeNull();
  });

  test('la foto propia de la vista frontal sí se puede borrar', async () => {
    mockVehicle({
      imageUrl: CATALOG,
      images: [{ view_type: 'front', image_url: OWN }],
    });
    renderDetail();

    const img = await screen.findByAltText('Delantera');
    await waitFor(() => {
      expect(img.getAttribute('src')).toContain('front.webp');
    });
    expect(img.parentElement.querySelector('button')).not.toBeNull();
  });
});
