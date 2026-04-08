const {
  storagePathFromPublicUrl,
  VEHICLE_IMAGES_BUCKET,
} = require('../lib/vehicleImageStorage');

describe('storagePathFromPublicUrl', () => {
  it('extrae la clave tras el nombre del bucket', () => {
    const url = `https://abc.supabase.co/storage/v1/object/public/${VEHICLE_IMAGES_BUCKET}/vehicles/u1/f.webp`;
    expect(storagePathFromPublicUrl(url)).toBe('vehicles/u1/f.webp');
  });

  it('ignora query string', () => {
    const url = `https://x.test/${VEHICLE_IMAGES_BUCKET}/vehicles/x/a.jpg?token=1`;
    expect(storagePathFromPublicUrl(url)).toBe('vehicles/x/a.jpg');
  });

  it('devuelve null si no coincide el bucket', () => {
    expect(storagePathFromPublicUrl('https://evil.test/other-bucket/path')).toBeNull();
  });

  it('devuelve null para entrada vacía', () => {
    expect(storagePathFromPublicUrl('')).toBeNull();
    expect(storagePathFromPublicUrl(null)).toBeNull();
  });
});
