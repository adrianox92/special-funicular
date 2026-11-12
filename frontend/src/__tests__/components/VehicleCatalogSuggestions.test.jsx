import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VehicleCatalogAssist from '../../components/VehicleCatalogSuggestions';
import api from '../../lib/axios';

jest.mock('../../lib/axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../components/CatalogListingImage', () => ({
  __esModule: true,
  default: ({ alt }) => <img alt={alt || 'catalog'} />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => {
      const dict = {
        'catalogSuggest.title': '¿Es alguno de estos?',
        'catalogSuggest.hint': 'Sugerencias del catálogo',
        'catalogSuggest.useThis': 'Es este',
        'catalogSuggest.linked': 'Enlazado al catálogo',
        'catalogSuggest.searching': 'Buscando coincidencias…',
        'catalogSuggest.variantsTitle': 'Variantes parecidas — elige la correcta',
        'catalogSuggest.noImage': 'Sin foto',
        'fieldSwap.title': '¿Has intercambiado modelo y referencia?',
        'fieldSwap.body': 'El modelo parece un código ({{model}}) y la referencia un nombre ({{reference}}).',
        'fieldSwap.action': 'Intercambiar',
      };
      let out = dict[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          out = out.replace(`{{${k}}}`, String(v));
        });
      }
      return out;
    },
  }),
}));

const aw = {
  id: 'aaaa',
  manufacturer: 'NSR',
  reference: '0135AW',
  model_name: 'Audi R8 LMS AW',
  variant_bits: ['AW'],
  image_url: 'https://cdn.example/aw.jpg',
};
const sw = {
  id: 'bbbb',
  manufacturer: 'NSR',
  reference: '0135SW',
  model_name: 'Audi R8 LMS SW',
  variant_bits: ['SW'],
  image_url: 'https://cdn.example/sw.jpg',
};

describe('VehicleCatalogAssist', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  test('muestra aviso de intercambio y permite intercambiar', () => {
    const onSwapFields = jest.fn();
    render(
      <VehicleCatalogAssist
        manufacturer="Scaleauto"
        model="U10522S300"
        reference="CUPRA LEÓN COMPETICIÓN - J. FILIPPI"
        onSwapFields={onSwapFields}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('¿Has intercambiado modelo y referencia?')).toBeInTheDocument();
    expect(screen.getByText(/U10522S300/)).toBeInTheDocument();
    expect(screen.getByText(/CUPRA LEÓN COMPETICIÓN/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Intercambiar' }));
    expect(onSwapFields).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'CUPRA LEÓN COMPETICIÓN - J. FILIPPI',
        reference: 'U10522S300',
      }),
    );
  });

  test('muestra variantes lado a lado y Es este enlaza', async () => {
    api.get.mockResolvedValue({
      data: {
        groups: [{ key: 'nsr-audi', variant_group: true, items: [aw, sw] }],
      },
    });
    const onSelect = jest.fn();
    render(
      <VehicleCatalogAssist
        manufacturer="NSR"
        model="Audi R8 LMS"
        reference=""
        onSelect={onSelect}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Variantes parecidas — elige la correcta')).toBeInTheDocument();
    });
    expect(screen.getByText('0135AW')).toBeInTheDocument();
    expect(screen.getByText('0135SW')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Es este' })[0]);
    expect(onSelect).toHaveBeenCalledWith(aw);
  });

  test('si ya hay enlace de catálogo no busca', () => {
    render(
      <VehicleCatalogAssist
        manufacturer="NSR"
        model="Audi"
        catalogItemId="already"
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('Enlazado al catálogo')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
