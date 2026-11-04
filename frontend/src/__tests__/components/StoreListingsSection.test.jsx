import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import StoreListingsSection from '../../components/StoreListingsSection';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const ITEM_ID = '11111111-1111-4111-8111-111111111111';

describe('StoreListingsSection', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  test('no pinta nada si no hay ofertas en stock', async () => {
    api.get.mockResolvedValue({ data: [] });
    const { container } = render(<StoreListingsSection catalogItemId={ITEM_ID} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  test('agrupa por país, usa el logo remoto y el acortador', async () => {
    api.get.mockResolvedValue({
      data: [
        {
          id: 'a',
          short_code: 'Ab3kX9p',
          price: 42.5,
          previous_price: 50,
          currency: 'EUR',
          shop_name: 'Slot Norte',
          country_code: 'ES',
          logo_url: 'https://cdn.example/slot-norte.png',
        },
        {
          id: 'b',
          short_code: 'Zy8mN2q',
          price: 39,
          currency: 'GBP',
          shop_name: 'Pit Lane',
          country_code: 'GB',
          logo_url: 'https://cdn.example/pit-lane.png',
        },
      ],
    });

    render(<StoreListingsSection catalogItemId={ITEM_ID} />);

    expect(await screen.findByRole('heading', { name: 'España' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reino Unido' })).toBeInTheDocument();

    const spain = screen.getByRole('region', { name: 'España' });
    const logo = spain.querySelector('img');
    expect(logo).toHaveAttribute('src', 'https://cdn.example/slot-norte.png');

    const link = screen.getByRole('link', { name: 'Ver Slot Norte en tienda' });
    expect(link.getAttribute('href')).toMatch(/\/go\/Ab3kX9p$/);
    expect(link).toHaveAttribute('rel', expect.stringContaining('sponsored'));
    expect(spain).toHaveTextContent('42,50');
    expect(spain.querySelector('.line-through')).toHaveTextContent('50,00');
    expect(screen.getByRole('region', { name: 'Reino Unido' }).querySelector('.line-through')).toBeNull();
  });
});
