import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import CatalogTechSpecsFields from '../../components/CatalogTechSpecsFields';
import {
  emptyTechSpecForm,
  VEHICLE_FORM_OMIT_TECH_SPEC_KEYS,
} from '../../data/catalogTechSpecs';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

function Harness({ omitKeys, form: initial = emptyTechSpecForm() }) {
  const [form, setForm] = useState(initial);
  return (
    <CatalogTechSpecsFields form={form} setForm={setForm} omitKeys={omitKeys} idPrefix="test-tech" />
  );
}

describe('CatalogTechSpecsFields', () => {
  test('muestra diámetro de llanta junto al material', () => {
    render(<Harness />);
    expect(screen.getByLabelText('techSpecs.fields.frontRim')).toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.frontRimDiameterMm')).toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.rearRim')).toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.rearRimDiameterMm')).toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.motor')).toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.pinionGear')).toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.frontWheels')).toBeInTheDocument();
  });

  test('omitKeys oculta motor, piñón y ruedas del formulario de vehículo', () => {
    render(<Harness omitKeys={VEHICLE_FORM_OMIT_TECH_SPEC_KEYS} />);
    expect(screen.queryByLabelText('techSpecs.fields.motor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('techSpecs.fields.pinionGear')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('techSpecs.fields.frontWheels')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('techSpecs.fields.rearWheels')).not.toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.frontRim')).toBeInTheDocument();
    expect(screen.getByLabelText('techSpecs.fields.frontRimDiameterMm')).toBeInTheDocument();
  });
});
