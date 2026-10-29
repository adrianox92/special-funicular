import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminSlotIntelligence from '../../pages/AdminSlotIntelligence';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  invalidateApiAccessTokenCache: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', email: 'admin@example.com' } }),
}));

jest.mock('../../lib/licenseAdmin', () => ({
  isLicenseAdminUser: () => true,
}));

const BRAND_ID = '11111111-1111-4111-8111-111111111111';

const PAYLOAD = {
  computed_at: '2026-10-29T18:00:00.000Z',
  stale_refreshed: false,
  summary: {
    computed_at: '2026-10-29T18:00:00.000Z',
    catalog_items_total: 10000,
    catalog_items_with_owners: 2500,
    coverage_pct: 25,
    linked_vehicle_count: 6000,
    linked_user_count: 400,
    vehicles_with_price: 1800,
    price_coverage_pct: 30,
    global_price_median: 49.9,
    global_price_p25: 30,
    global_price_p75: 70,
    publishable_item_count: 120,
    top10_refs_vehicle_share_pct: 12.5,
    top5_brands_vehicle_share_pct: 60,
    rarity_histogram: [
      { bucket: '0', item_count: 7500 },
      { bucket: '1', item_count: 1500 },
      { bucket: '2_4', item_count: 800 },
      { bucket: '5_14', item_count: 150 },
      { bucket: '15_plus', item_count: 50 },
    ],
    garage_price_basis: 'declared_as_eur',
  },
  brands: [
    {
      manufacturer_id: BRAND_ID,
      brand_name: 'Scalextric',
      catalog_item_count: 4000,
      items_with_owners: 900,
      coverage_pct: 22.5,
      vehicle_count: 3000,
      user_count: 200,
      garage_price_n: 800,
      garage_price_median: 45,
      listing_count: 10,
      listing_price_n: 8,
      listing_price_median: 52,
    },
  ],
  places: {
    global: [{ scope: 'global', place_label: 'wallapop', vehicle_count: 40, user_count: 15 }],
    brand: [],
  },
  items: {
    total: 2,
    limit: 50,
    offset: 0,
    sort: 'owners',
    manufacturer_id: null,
    publishable: null,
    rows: [
      {
        catalog_item_id: 'a',
        brand_name: 'Scalextric',
        reference: 'C4032',
        model_name: 'Porsche 911',
        vehicle_count: 20,
        owner_count: 12,
        penetration_pct: 3,
        garage_price_n: 8,
        garage_price_median: 55,
        garage_price_p25: 40,
        garage_price_p75: 70,
        listing_price_n: 2,
        listing_price_median: 60,
        publishable: true,
      },
      {
        catalog_item_id: 'b',
        brand_name: 'Ninco',
        reference: '50612',
        model_name: 'Clio',
        vehicle_count: 2,
        owner_count: 2,
        penetration_pct: 0.5,
        garage_price_n: 1,
        garage_price_median: 15,
        garage_price_p25: 15,
        garage_price_p75: 15,
        listing_price_n: 0,
        listing_price_median: null,
        publishable: false,
      },
    ],
  },
};

function eur(value) {
  return `${Number(value).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

describe('AdminSlotIntelligence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: PAYLOAD });
    api.post.mockResolvedValue({ data: { computed_at: PAYLOAD.computed_at } });
  });

  it('muestra resumen, marca, precios y la marca de no publicable', async () => {
    render(
      <MemoryRouter>
        <AdminSlotIntelligence />
      </MemoryRouter>,
    );

    expect(await screen.findByText(eur(49.9))).toBeInTheDocument();
    expect(screen.getByText((1800).toLocaleString('es-ES'))).toBeInTheDocument();
    expect(screen.getByText((120).toLocaleString('es-ES'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scalextric' })).toBeInTheDocument();
    expect(
      screen.getByText(
        `${(22.5).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('C4032')).toBeInTheDocument();
    expect(screen.getByText('50612')).toBeInTheDocument();
    expect(screen.getByText('wallapop')).toBeInTheDocument();
    expect(screen.getByText('Sin dueños')).toBeInTheDocument();

    const popular = screen.getByText('C4032').closest('tr');
    const rare = screen.getByText('50612').closest('tr');
    expect(popular).toHaveTextContent(eur(55));
    expect(popular).not.toHaveTextContent('No publicable');
    expect(rare).toHaveTextContent('No publicable');
    expect(rare).toHaveTextContent(eur(15));
  });

  it('recalcula y vuelve a pedir la foto', async () => {
    render(
      <MemoryRouter>
        <AdminSlotIntelligence />
      </MemoryRouter>,
    );

    await screen.findByText('C4032');
    await userEvent.click(screen.getByRole('button', { name: 'Recalcular' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/slot-intelligence/refresh');
    });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });
});
