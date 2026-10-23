const {
  extractCatalogCarIdentity,
  catalogCarIdentityColumns,
} = require('../../lib/catalogCarIdentity');

describe('extractCatalogCarIdentity', () => {
  test('separa marca y familia de modelo', () => {
    expect(extractCatalogCarIdentity('Toyota Yaris Rally 2 - \'24 Rally Japan')).toEqual({
      car_make: 'Toyota',
      car_model: 'Yaris',
    });
    expect(extractCatalogCarIdentity('Alfa Romeo 155 V6')).toEqual({
      car_make: 'Alfa Romeo',
      car_model: '155',
    });
    expect(extractCatalogCarIdentity('Alfa 155')).toEqual({
      car_make: 'Alfa Romeo',
      car_model: '155',
    });
    expect(extractCatalogCarIdentity('Audi RS 5 DTM "R.Rast, No.33"')).toEqual({
      car_make: 'Audi',
      car_model: 'RS 5',
    });
    expect(extractCatalogCarIdentity('PORSCHE 911 GT3')).toEqual({
      car_make: 'Porsche',
      car_model: '911',
    });
    expect(extractCatalogCarIdentity('BMW M4 DTM')).toEqual({
      car_make: 'BMW',
      car_model: 'M4',
    });
    expect(extractCatalogCarIdentity('Ford Mustang Shelby')).toEqual({
      car_make: 'Ford',
      car_model: 'Mustang',
    });
  });

  test('reconoce abreviaturas y modelos que omiten la marca', () => {
    expect(extractCatalogCarIdentity('Mustang GT')).toEqual({
      car_make: 'Ford',
      car_model: 'Mustang',
    });
    expect(extractCatalogCarIdentity('Corvette C6R')).toEqual({
      car_make: 'Chevrolet',
      car_model: 'Corvette',
    });
    expect(extractCatalogCarIdentity('Chevrolet Corvette C6R')).toEqual({
      car_make: 'Chevrolet',
      car_model: 'Corvette',
    });
    expect(extractCatalogCarIdentity('VW Golf')).toEqual({
      car_make: 'Volkswagen',
      car_model: 'Golf',
    });
    expect(extractCatalogCarIdentity('F. 296 GT3')).toEqual({
      car_make: 'Ferrari',
      car_model: '296',
    });
    expect(extractCatalogCarIdentity('F296 GT3')).toEqual({
      car_make: 'Ferrari',
      car_model: '296',
    });
  });

  test('no rellena nombres que no empiezan por una marca de coche', () => {
    expect(extractCatalogCarIdentity('Formula 1')).toEqual({ car_make: null, car_model: null });
    expect(extractCatalogCarIdentity('Kit carrocería blanca')).toEqual({
      car_make: null,
      car_model: null,
    });
    expect(extractCatalogCarIdentity('   ')).toEqual({ car_make: null, car_model: null });
  });

  test('el guardado automático no pisa una corrección manual', () => {
    expect(catalogCarIdentityColumns('Toyota Yaris Rally 2', 'manual')).toBeNull();
    expect(catalogCarIdentityColumns('Toyota Yaris Rally 2', null)).toEqual({
      car_make: 'Toyota',
      car_model: 'Yaris',
      car_identity_source: 'auto',
    });
    expect(catalogCarIdentityColumns('Formula 1')).toEqual({
      car_make: null,
      car_model: null,
      car_identity_source: 'auto',
    });
  });
});
