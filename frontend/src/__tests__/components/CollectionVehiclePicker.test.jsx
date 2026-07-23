import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CollectionVehiclePicker from '../../components/CollectionVehiclePicker';

const vehicles = [
  { id: 'v1', manufacturer: 'Scalextric', model: 'Ferrari F1', type: 'F1' },
  { id: 'v2', manufacturer: 'Carrera', model: 'Porsche 911', type: 'GT' },
  { id: 'v3', manufacturer: 'Fly', model: 'BMW M3', type: 'Touring' },
];

describe('CollectionVehiclePicker', () => {
  test('filtra vehículos por marca o modelo', async () => {
    const onChange = jest.fn();

    render(
      <CollectionVehiclePicker
        vehicles={vehicles}
        value=""
        onChange={onChange}
        placeholder="Elige vehículo"
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByPlaceholderText(/Buscar por marca/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por marca/i), {
      target: { value: 'porsche' },
    });
    expect(screen.queryByText(/Ferrari F1/)).not.toBeInTheDocument();
    expect(screen.getByText(/Porsche 911/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Porsche 911/));
    expect(onChange).toHaveBeenCalledWith('v2');
  });

  test('muestra mensaje cuando no hay coincidencias', async () => {
    render(<CollectionVehiclePicker vehicles={vehicles} value="" onChange={jest.fn()} />);

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByPlaceholderText(/Buscar por marca/i), {
      target: { value: 'lamborghini' },
    });

    expect(screen.getByText(/Ningún vehículo coincide/i)).toBeInTheDocument();
  });
});
