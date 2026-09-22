const sharp = require('sharp');
const {
  processVehicleImageBuffer,
  getMaxEdgePx,
  getOutputFormat,
  getWebpQuality,
  DEFAULT_MAX_EDGE,
  DEFAULT_WEBP_QUALITY,
} = require('../lib/processVehicleImageBuffer');

const IMAGE_ENV_KEYS = [
  'VEHICLE_IMAGE_MAX_EDGE_PX',
  'VEHICLE_IMAGE_WEBP_QUALITY',
  'VEHICLE_IMAGE_OUTPUT_FORMAT',
  'VEHICLE_IMAGE_JPEG_QUALITY',
];

describe('processVehicleImageBuffer', () => {
  const originalEnv = {};

  beforeEach(() => {
    for (const key of IMAGE_ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of IMAGE_ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('usa defaults de producción: WebP, lado largo 1400, calidad 70', () => {
    expect(DEFAULT_MAX_EDGE).toBe(1400);
    expect(DEFAULT_WEBP_QUALITY).toBe(70);
    expect(getMaxEdgePx()).toBe(1400);
    expect(getWebpQuality()).toBe(70);
    expect(getOutputFormat()).toBe('webp');
  });

  it('respeta overrides de entorno (MAX_EDGE / WEBP_QUALITY / FORMAT)', () => {
    process.env.VEHICLE_IMAGE_MAX_EDGE_PX = '800';
    process.env.VEHICLE_IMAGE_WEBP_QUALITY = '55';
    process.env.VEHICLE_IMAGE_OUTPUT_FORMAT = 'jpeg';
    expect(getMaxEdgePx()).toBe(800);
    expect(getWebpQuality()).toBe(55);
    expect(getOutputFormat()).toBe('jpeg');
  });

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

  it('restringe el lado largo al default 1400px sin agrandar', async () => {
    const png = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: { r: 40, g: 80, b: 120 },
      },
    })
      .png()
      .toBuffer();

    const { buffer, contentType } = await processVehicleImageBuffer(png, 'image/png');
    const meta = await sharp(buffer).metadata();

    expect(contentType).toBe('image/webp');
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1400);
    expect(meta.height).toBe(700);
  });

  it('aplica VEHICLE_IMAGE_MAX_EDGE_PX al redimensionar', async () => {
    process.env.VEHICLE_IMAGE_MAX_EDGE_PX = '640';
    const png = await sharp({
      create: {
        width: 1280,
        height: 960,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const { buffer } = await processVehicleImageBuffer(png, 'image/png');
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(640);
    expect(meta.height).toBe(480);
  });

  it('rechaza buffer vacío', async () => {
    await expect(processVehicleImageBuffer(Buffer.alloc(0), 'image/png')).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
  });
});
