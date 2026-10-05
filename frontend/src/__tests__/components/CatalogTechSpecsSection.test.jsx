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
        'techSpecs.fields.frontRim': 'Llanta delantera',
        'techSpecs.fields.rearRim': 'Llanta trasera',
        'techSpecs.fields.frontRimDiameterMm': 'Diámetro llanta delantera (mm)',
        'techSpecs.fields.rearRimDiameterMm': 'Diámetro llanta trasera (mm)',
        'techSpecs.fields.frontLights': 'Luces delanteras',
        'techSpecs.fields.rearLights': 'Luces traseras',
        'techSpecs.systemValues.analog': 'Analógico',
        'techSpecs.systemValues.digital': 'Digital',
        'techSpecs.rimValues.plastic': 'Plástico',
        'techSpecs.rimValues.aluminum': 'Aluminio',
        'techSpecs.rimValues.magnesium': 'Magnesio',
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
    const { container } = render(
      <CatalogTechSpecsSection
        item={{
          spec_scale: '1:32',
          spec_body: 'Plastic',
          spec_color: 'Black',
          spec_system: 'digital',
          spec_length_mm: '145.00',
          spec_front_axle_width_mm: 52,
          spec_rear_axle_width_mm: '',
          spec_magnet: false,
          spec_motor: 'S-Can 18,000rpm',
          traction: 'Trasera',
          motor_position: 'inline',
          spec_front_lights: true,
          spec_rear_lights: false,
          spec_front_rim: 'plastic',
          spec_rear_rim: 'aluminum',
          spec_front_rim_diameter_mm: 15.8,
        }}
      />,
    );
    expect(screen.getByText('Información técnica')).toBeInTheDocument();
    expect(screen.getByText('Escala')).toBeInTheDocument();
    expect(screen.getByText('1:32')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.getByText('Digital')).toBeInTheDocument();
    expect(screen.queryByText('Digital Plug Ready')).not.toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument();
    expect(screen.getByText('Ancho de ejes delantero (mm)')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('Trasera')).toBeInTheDocument();
    expect(screen.getByText('En línea')).toBeInTheDocument();
    expect(screen.getByText('Luces delanteras')).toBeInTheDocument();
    expect(screen.queryByText('Luces traseras')).not.toBeInTheDocument();
    expect(screen.queryByText('Ancho de ejes trasero (mm)')).not.toBeInTheDocument();
    expect(screen.getByText('Llanta delantera')).toBeInTheDocument();
    expect(screen.getByText('Llanta trasera')).toBeInTheDocument();
    expect(screen.getByText('Diámetro llanta delantera (mm)')).toBeInTheDocument();
    expect(screen.getByText('15.8')).toBeInTheDocument();
    expect(screen.getByText('Plástico')).toBeInTheDocument();
    expect(screen.getByText('Aluminio')).toBeInTheDocument();
    expect(screen.queryByText('plastic')).not.toBeInTheDocument();
    expect(screen.queryByText('Neumáticos delanteros')).not.toBeInTheDocument();
    const grid = container.querySelector('dl');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  test('empareja delantera y trasera en la misma fila', () => {
    render(
      <CatalogTechSpecsSection
        item={{
          spec_front_track_mm: 50,
          spec_rear_track_mm: 52,
          spec_front_axle_width_mm: 51,
          spec_rear_axle_width_mm: 53,
          spec_front_wheels: 'Ø15.8',
          spec_rear_wheels: 'Ø16.5',
          spec_front_rim: 'plastic',
          spec_rear_rim: 'magnesium',
          spec_front_rim_diameter_mm: 15.8,
          spec_rear_rim_diameter_mm: 16.5,
          spec_front_lights: true,
          spec_rear_lights: true,
        }}
      />,
    );
    const rims = screen.getByTestId('tech-spec-pair-rims');
    expect(rims).toHaveClass('md:col-span-2');
    expect(rims).toHaveTextContent('Llanta delantera');
    expect(rims).toHaveTextContent('Llanta trasera');
    expect(rims).toHaveTextContent('Plástico');
    expect(rims).toHaveTextContent('Magnesio');
    expect(rims).toHaveTextContent('Diámetro llanta delantera (mm)');
    expect(rims).toHaveTextContent('Diámetro llanta trasera (mm)');
    expect(rims).toHaveTextContent('15.8');
    expect(rims).toHaveTextContent('16.5');
    expect(screen.getByTestId('tech-spec-pair-wheels')).toHaveTextContent('Ruedas delanteras');
    expect(screen.getByTestId('tech-spec-pair-wheels')).toHaveTextContent('Ruedas traseras');
    expect(screen.getByTestId('tech-spec-pair-track')).toHaveTextContent('Vía delantera (mm)');
    expect(screen.getByTestId('tech-spec-pair-track')).toHaveTextContent('Vía trasera (mm)');
    expect(screen.getByTestId('tech-spec-pair-axleWidth')).toHaveTextContent(
      'Ancho de ejes delantero (mm)',
    );
    expect(screen.getByTestId('tech-spec-pair-axleWidth')).toHaveTextContent(
      'Ancho de ejes trasero (mm)',
    );
    expect(screen.getByTestId('tech-spec-pair-lights')).toHaveTextContent('Luces delanteras');
    expect(screen.getByTestId('tech-spec-pair-lights')).toHaveTextContent('Luces traseras');
  });

  test('modo embedded no usa el card de ficha', () => {
    const { container } = render(
      <CatalogTechSpecsSection embedded item={{ spec_scale: '1:32' }} />,
    );
    expect(container.querySelector('.rounded-xl')).toBeNull();
    expect(screen.getByText('Información técnica')).toBeInTheDocument();
    expect(screen.getByText('1:32')).toBeInTheDocument();
  });
});
