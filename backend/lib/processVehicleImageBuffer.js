/**
 * Redimensiona y comprime imágenes de vehículo antes de subirlas a Storage.
 *
 * Variables de entorno opcionales:
 * - VEHICLE_IMAGE_MAX_EDGE_PX: lado largo máximo (default 2048)
 * - VEHICLE_IMAGE_OUTPUT_FORMAT: "webp" (default) o "jpeg"
 * - VEHICLE_IMAGE_WEBP_QUALITY: 1-100 (default 80)
 * - VEHICLE_IMAGE_JPEG_QUALITY: 1-100 (default 85)
 */

const sharp = require('sharp');

const DEFAULT_MAX_EDGE = 2048;

function getMaxEdgePx() {
  const raw = process.env.VEHICLE_IMAGE_MAX_EDGE_PX;
  if (raw == null || raw === '') return DEFAULT_MAX_EDGE;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8192) : DEFAULT_MAX_EDGE;
}

function getOutputFormat() {
  const f = String(process.env.VEHICLE_IMAGE_OUTPUT_FORMAT || 'webp').toLowerCase();
  return f === 'jpeg' || f === 'jpg' ? 'jpeg' : 'webp';
}

function getWebpQuality() {
  const raw = process.env.VEHICLE_IMAGE_WEBP_QUALITY;
  if (raw == null || raw === '') return 80;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 80;
}

function getJpegQuality() {
  const raw = process.env.VEHICLE_IMAGE_JPEG_QUALITY;
  if (raw == null || raw === '') return 85;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 85;
}

/**
 * @param {Buffer} buffer
 * @param {string} [mimetype] hint only
 * @returns {Promise<{ buffer: Buffer, contentType: string, ext: string }>}
 */
async function processVehicleImageBuffer(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('Imagen vacía o no válida');
    err.code = 'INVALID_IMAGE';
    throw err;
  }

  const maxEdge = getMaxEdgePx();
  const format = getOutputFormat();

  try {
    let pipeline = sharp(buffer)
      .rotate()
      .resize(maxEdge, maxEdge, {
        fit: 'inside',
        withoutEnlargement: true,
      });

    let out;
    let contentType;
    let ext;
    if (format === 'jpeg') {
      out = await pipeline.jpeg({ quality: getJpegQuality(), mozjpeg: true }).toBuffer();
      contentType = 'image/jpeg';
      ext = '.jpg';
    } else {
      out = await pipeline.webp({ quality: getWebpQuality() }).toBuffer();
      contentType = 'image/webp';
      ext = '.webp';
    }

    return { buffer: out, contentType, ext };
  } catch (e) {
    const err = new Error(e.message ? `No se pudo procesar la imagen: ${e.message}` : 'No se pudo procesar la imagen');
    err.code = 'INVALID_IMAGE';
    throw err;
  }
}

module.exports = {
  processVehicleImageBuffer,
  getMaxEdgePx,
  getOutputFormat,
};
