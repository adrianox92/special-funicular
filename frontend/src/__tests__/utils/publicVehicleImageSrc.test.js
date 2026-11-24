import { publicVehicleImageSrc } from '../../utils/publicVehicleImageSrc';

const VEHICLE =
  'https://abcdxyz.supabase.co/storage/v1/object/public/vehicle-images/vehicles/u1/front.webp';
const CATALOG =
  'https://abcdxyz.supabase.co/storage/v1/object/public/catalog-images/catalog/1710000000-ab12cd.webp';

describe('publicVehicleImageSrc', () => {
  test('acepta fotos de Storage de vehículo y de catálogo', () => {
    expect(publicVehicleImageSrc(VEHICLE)).toContain('vehicle-images');
    expect(publicVehicleImageSrc(CATALOG)).toContain('catalog-images');
  });

  test('rechaza fotos ajenas (picsum, CDN genérico) y vacío', () => {
    expect(publicVehicleImageSrc('https://picsum.photos/seed/slot-porsche/640/480')).toBe('');
    expect(publicVehicleImageSrc('https://cdn.example/vehicle-images/porshe.webp')).toBe('');
    expect(publicVehicleImageSrc(null)).toBe('');
    expect(publicVehicleImageSrc('')).toBe('');
  });

  test('acepta URLs ya proxificadas a /api/img (relativa y absoluta)', () => {
    expect(publicVehicleImageSrc('/api/img/catalog-images/catalog/911.webp')).toBe(
      '/api/img/catalog-images/catalog/911.webp',
    );
    expect(
      publicVehicleImageSrc(
        'https://www.slotdatabase.es/api/img/catalog-images/catalog/911.webp',
      ),
    ).toBe('https://www.slotdatabase.es/api/img/catalog-images/catalog/911.webp');
  });

  test('acepta fotos de R2 servidas por /api/img/r2/ y rechaza buckets ajenos', () => {
    const r2 = 'https://www.slotdatabase.es/api/img/r2/vehicle-images/vehicles/u1/front.webp';
    expect(publicVehicleImageSrc(r2)).toBe(r2);
    expect(publicVehicleImageSrc('/api/img/r2/catalog-images/catalog/911.webp')).toBe(
      '/api/img/r2/catalog-images/catalog/911.webp',
    );
    expect(publicVehicleImageSrc('/api/img/r2/secret/x.webp')).toBe('');
  });
});
