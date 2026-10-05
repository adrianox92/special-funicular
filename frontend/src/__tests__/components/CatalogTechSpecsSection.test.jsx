import React from 'react';
import { render, screen } from '@testing-library/react';
import CatalogTechSpecsSection from '../../components/CatalogTechSpecsSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const map = {
        'techSpecs.title': 'Información técnica',
        'techSpecs.yes': 'Sí',
        'techSpecs.no': 'No',
        'techSpecs.fields.scale': 'Escala',
        'techSpecs.fields.body': 'Carrocería',
        'techSpecs.fields.color': 'Color',
        'techSpecs.fields.system': 'Sistema',
        'techSpecs.fields.lengthMm': 'Longitud (mm)',
        'techSpecs.fields.heightMm': 'Altura (mm)',
        'techSpecs.fields.wheelbaseMm': 'Batalla (mm)',
        'techSpecs.fields.frontTrackMm': 'Vía delantera (mm)',
        'techSpecs.fields.rearTrackMm': 'Vía trasera (mm)',
        'techSpecs.fields.frontAxleWidthMm': 'Ancho de ejes delantero (mm)',
        'techSpecs.fields.rearAxleWidthMm': 'Ancho de ejes trasero (mm)',
        'techSpecs.fields.weightG': 'Peso (g)',
        'techSpecs.fields.magnet': 'Imán',
        'techSpecs.fields.motor': 'Motor',
        'techSpecs.fields.motorMount': 'Soporte del motor',
        'techSpecs.fields.drivetrain': 'Transmisión',
        'techSpecs.fields.pinionGear': 'Piñón / corona',
        'techSpecs.fields.frontWheels': 'Ruedas delanteras',
        'techSpecs.fields.rearWheels': 'Ruedas traseras',
        'techSpecs.fields.frontTyres': 'Neumáticos delanteros',
        'techSpecs.fields.rearTyres': 'Neumáticos traseros',
        'techSpecs.fields.lights': 'Luces',
        'values.motorPosition.inline': 'En línea',
        'values.traction.Trasera': 'Trasera',
      };
      if (map[key]) return map[key];
      return opts?.defaultValue || key;
    },
  }),
}));

describe('CatalogTechSpecsSection', () => {
  test('no renderiza nada si no hay specs nuevas', () => {
    const { container } = render(
      <CatalogTechSpecsSection item={{ traction: 'Trasera', motor_position: 'inline' }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('muestra filas rellenas y oculta vacías', () => {
    render(
      <CatalogTechSpecsSection
        item={{
          spec_scale: '1:32',
          spec_body: 'Plastic',
          spec_color: 'Black',
          spec_system: 'Digital Plug Ready',
          spec_length_mm: '145.00',
          spec_front_axle_width_mm: 52,
          spec_rear_axle_width_mm: '',
          spec_magnet: false,
          spec_motor: 'S-Can 18,000rpm',
          traction: 'Trasera',
          motor_position: 'inline',
          spec_lights: '',
        }}
      />,
    );
    expect(screen.getByText('Información técnica')).toBeInTheDocument();
    expect(screen.getByText('Escala')).toBeInTheDocument();
    expect(screen.getByText('1:32')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('Digital Plug Ready')).toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument();
    expect(screen.getByText('Ancho de ejes delantero (mm)')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('Trasera')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.queryByText('Luces')).not.toBeInTheDocument();
    expect(screen.queryByText('Ancho de ejes trasero (mm)')).not.toBeInTheDocument();
  });
});
