const sharp = require('sharp');
const { processVehicleImageBuffer } = require('../lib/processVehicleImageBuffer');

describe('processVehicleImageBuffer', () => {
  it('devuelve webp y buffer más pequeño que un PNG de prueba', async () => {
    const png = await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const { buffer, contentType, ext } = await processVehicleImageBuffer(png, 'image/png');

    expect(contentType).toBe('image/webp');
    expect(ext).toBe('.webp');
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.length).toBeLessThan(png.length * 2);
  });

  it('rechaza buffer vacío', async () => {
    await expect(processVehicleImageBuffer(Buffer.alloc(0), 'image/png')).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
  });
});
