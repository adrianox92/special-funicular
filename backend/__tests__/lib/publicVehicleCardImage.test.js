const { resolvePublicVehicleCardImage } = require('../../lib/publicVehicleCardImage');

describe('resolvePublicVehicleCardImage', () => {
  const ownThree = {
    image_url: 'https://abcd.supabase.co/storage/v1/object/public/vehicle-images/vehicles/u1/tq.webp',
    view_type: 'three_quarters',
  };
  const ownFront = {
    image_url: 'https://abcd.supabase.co/storage/v1/object/public/vehicle-images/vehicles/u1/front.webp',
    view_type: 'front',
  };
  const catalog =
    'https://abcd.supabase.co/storage/v1/object/public/catalog-images/catalog/911.webp';

  test('prioriza la foto del vehículo sobre la del catálogo', () => {
    expect(
      resolvePublicVehicleCardImage({
        vehicleImages: [ownFront, ownThree],
        catalogImageUrl: catalog,
      }),
    ).toBe(ownThree.image_url);
  });

  test('usa la foto de catálogo si el vehículo no tiene ninguna', () => {
    expect(resolvePublicVehicleCardImage({ vehicleImages: [], catalogImageUrl: catalog })).toBe(catalog);
  });

  test('no inventa una foto si no hay ni vehículo ni catálogo', () => {
    expect(resolvePublicVehicleCardImage({ vehicleImages: [], catalogImageUrl: null })).toBeNull();
    expect(resolvePublicVehicleCardImage({ vehicleImages: [], catalogImageUrl: '   ' })).toBeNull();
  });
});
