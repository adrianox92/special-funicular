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
});
