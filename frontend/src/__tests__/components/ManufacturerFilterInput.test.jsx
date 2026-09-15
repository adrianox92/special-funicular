import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManufacturerFilterInput } from '../../components/ManufacturerFilterInput';

function Harness({ manufacturers }) {
  const [value, setValue] = useState('');
  return (
    <ManufacturerFilterInput
      id="filter-manufacturer"
      value={value}
      onChange={setValue}
      manufacturers={manufacturers}
      placeholder="Buscar fabricante..."
    />
  );
}

describe('ManufacturerFilterInput', () => {
  test('al elegir una sugerencia emite el nombre exacto (incl. punto)', async () => {
    const onChange = jest.fn();
    render(
      <ManufacturerFilterInput
        id="filter-manufacturer"
        value=""
        onChange={onChange}
        manufacturers={['Ninco', 'Slot.it']}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('button', { name: 'Slot.it' }));
    expect(onChange).toHaveBeenCalledWith('Slot.it');
  });

  test('escribir texto libre llama onChange en cada carácter', async () => {
    render(<Harness manufacturers={['Ninco']} />);
    await userEvent.type(screen.getByRole('combobox'), 'Ni');
    expect(screen.getByRole('combobox')).toHaveValue('Ni');
  });
});
