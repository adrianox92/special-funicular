const {
  uploadProvider,
  uploadObject,
  removeObjects,
  removePrefix,
  providerForUrl,
  r2PublicUrl,
  setR2ClientForTests,
} = require('../../lib/imageObjectStorage');
const { removeCatalogObjectByPublicUrl, uploadCatalogImageBuffer } = require('../../lib/catalogImageStorage');
const { removeObjectByPublicUrl, removeAllObjectsInVehicleFolder } = require('../../lib/vehicleImageStorage');

const R2_ENV = {
  IMAGE_STORAGE_PROVIDER: 'r2',
  R2_ACCOUNT_ID: 'acc123',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'slot-images',
  PUBLIC_IMAGE_ORIGIN: 'https://www.slotdatabase.es',
};
const R2_URL_PREFIX = 'https://www.slotdatabase.es/api/img/r2';

function fakeR2(listPages = []) {
  const calls = [];
  let page = 0;
  return {
    calls,
    async send(command) {
      const name = command.constructor.name;
      calls.push({ name, input: command.input });
      if (name === 'ListObjectsV2Command') {
        return listPages[page++] || { Contents: [], IsTruncated: false };
      }
      if (name === 'DeleteObjectsCommand') return { Errors: [] };
      return {};
    },
  };
}

function fakeSupabase({ listResponses = [] } = {}) {
  const storageCalls = [];
  let listCall = 0;
  const bucketApi = (bucket) => ({
    upload: jest.fn(async (path, _buf, opts) => {
      storageCalls.push({ op: 'upload', bucket, path, opts });
      return { error: null };
    }),
    getPublicUrl: jest.fn((path) => ({
      data: { publicUrl: `https://abcd.supabase.co/storage/v1/object/public/${bucket}/${path}` },
    })),
    remove: jest.fn(async (paths) => {
      storageCalls.push({ op: 'remove', bucket, paths });
      return { error: null };
    }),
    list: jest.fn(async (folder) => {
      storageCalls.push({ op: 'list', bucket, folder });
      return { data: listResponses[listCall++] || [], error: null };
    }),
  });
  return { storageCalls, storage: { from: jest.fn(bucketApi) } };
}

describe('imageObjectStorage', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    for (const k of Object.keys(R2_ENV)) delete process.env[k];
  });

  afterEach(() => {
    process.env = env;
    setR2ClientForTests(null);
    jest.restoreAllMocks();
  });

  test('uploadProvider: r2 solo con la configuración completa', () => {
    expect(uploadProvider({})).toBe('supabase');
    expect(uploadProvider(R2_ENV)).toBe('r2');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(uploadProvider({ ...R2_ENV, R2_BUCKET: '' })).toBe('supabase');
    expect(console.warn).toHaveBeenCalled();
  });

  test('sube a R2 con clave <bucket>/<ruta>, Cache-Control largo y URL pública', async () => {
    const r2 = fakeR2();
    setR2ClientForTests(r2);
    const supabase = fakeSupabase();
    const url = await uploadObject(
      supabase,
      'catalog-images',
      'catalog/1790000000-ab12cd.webp',
      Buffer.from('x'),
      'image/webp',
      { env: R2_ENV },
    );
    expect(url).toBe(`${R2_URL_PREFIX}/catalog-images/catalog/1790000000-ab12cd.webp`);
    expect(r2.calls).toHaveLength(1);
    expect(r2.calls[0].name).toBe('PutObjectCommand');
    expect(r2.calls[0].input).toMatchObject({
      Bucket: 'slot-images',
      Key: 'catalog-images/catalog/1790000000-ab12cd.webp',
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(supabase.storageCalls).toHaveLength(0);
  });

  test('sin R2 sube a Supabase como antes', async () => {
    const r2 = fakeR2();
    setR2ClientForTests(r2);
    const supabase = fakeSupabase();
    const url = await uploadObject(supabase, 'vehicle-images', 'vehicles/v1/a.webp', Buffer.from('x'), 'image/webp', {
      env: {},
      upsert: true,
    });
    expect(url).toBe('https://abcd.supabase.co/storage/v1/object/public/vehicle-images/vehicles/v1/a.webp');
    expect(supabase.storageCalls[0]).toMatchObject({
      op: 'upload',
      bucket: 'vehicle-images',
      opts: { contentType: 'image/webp', upsert: true, cacheControl: '31536000' },
    });
    expect(r2.calls).toHaveLength(0);
  });

  test('providerForUrl distingue por la ruta /api/img/r2/', () => {
    expect(providerForUrl(`${R2_URL_PREFIX}/catalog-images/catalog/a.webp`)).toBe('r2');
    expect(providerForUrl('https://preview.vercel.app/api/img/r2/catalog-images/catalog/a.webp')).toBe('r2');
    expect(
      providerForUrl('https://abcd.supabase.co/storage/v1/object/public/catalog-images/catalog/a.webp'),
    ).toBe('supabase');
    expect(providerForUrl('https://www.slotdatabase.es/api/img/catalog-images/catalog/a.webp')).toBe('supabase');
    expect(r2PublicUrl('vehicle-images', 'vehicles/v 1/a.webp', R2_ENV)).toBe(
      `${R2_URL_PREFIX}/vehicle-images/vehicles/v%201/a.webp`,
    );
  });

  test('removeObjects en R2 borra por lotes con la clave completa', async () => {
    const r2 = fakeR2();
    setR2ClientForTests(r2);
    const { error } = await removeObjects(fakeSupabase(), 'r2', 'vehicle-images', ['vehicles/v1/a.webp'], R2_ENV);
    expect(error).toBeNull();
    expect(r2.calls[0].name).toBe('DeleteObjectsCommand');
    expect(r2.calls[0].input.Delete.Objects).toEqual([{ Key: 'vehicle-images/vehicles/v1/a.webp' }]);
  });

  test('removeObjects devuelve el error de R2 sin lanzar', async () => {
    setR2ClientForTests({
      send: async () => ({ Errors: [{ Key: 'k', Message: 'AccessDenied' }] }),
    });
    const { error } = await removeObjects(fakeSupabase(), 'r2', 'vehicle-images', ['a.webp'], R2_ENV);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('AccessDenied');
  });

  test('borrar imagen de catálogo en R2 incluye la miniatura y no toca Supabase', async () => {
    Object.assign(process.env, R2_ENV);
    const r2 = fakeR2();
    setR2ClientForTests(r2);
    const supabase = fakeSupabase();
    const { error } = await removeCatalogObjectByPublicUrl(
      supabase,
      `${R2_URL_PREFIX}/catalog-images/catalog/1790000000-ab12cd.webp`,
    );
    expect(error).toBeNull();
    expect(r2.calls[0].input.Delete.Objects).toEqual([
      { Key: 'catalog-images/catalog/1790000000-ab12cd.webp' },
      { Key: 'catalog-images/catalog/1790000000-ab12cd-thumb.webp' },
    ]);
    expect(supabase.storageCalls).toHaveLength(0);
  });

  test('borrar foto de vehículo antigua sigue yendo a Supabase con R2 activo', async () => {
    Object.assign(process.env, R2_ENV);
    const r2 = fakeR2();
    setR2ClientForTests(r2);
    const supabase = fakeSupabase();
    const { error } = await removeObjectByPublicUrl(
      supabase,
      'https://abcd.supabase.co/storage/v1/object/public/vehicle-images/vehicles/v1/a.webp',
    );
    expect(error).toBeNull();
    expect(supabase.storageCalls).toEqual([
      { op: 'remove', bucket: 'vehicle-images', paths: ['vehicles/v1/a.webp'] },
    ]);
    expect(r2.calls).toHaveLength(0);
  });

  test('removeAllObjectsInVehicleFolder vacía Supabase y el prefijo en R2 (paginado)', async () => {
    Object.assign(process.env, R2_ENV);
    const r2 = fakeR2([
      {
        Contents: [{ Key: 'vehicle-images/vehicles/v1/a.webp' }],
        IsTruncated: true,
        NextContinuationToken: 't1',
      },
      { Contents: [{ Key: 'vehicle-images/vehicles/v1/b.webp' }], IsTruncated: false },
    ]);
    setR2ClientForTests(r2);
    const supabase = fakeSupabase({ listResponses: [[{ name: 'old.webp' }], []] });

    await removeAllObjectsInVehicleFolder(supabase, 'v1');

    expect(supabase.storageCalls).toEqual([
      { op: 'list', bucket: 'vehicle-images', folder: 'vehicles/v1' },
      { op: 'remove', bucket: 'vehicle-images', paths: ['vehicles/v1/old.webp'] },
    ]);
    const names = r2.calls.map((c) => c.name);
    expect(names).toEqual([
      'ListObjectsV2Command',
      'DeleteObjectsCommand',
      'ListObjectsV2Command',
      'DeleteObjectsCommand',
    ]);
    expect(r2.calls[0].input).toMatchObject({ Bucket: 'slot-images', Prefix: 'vehicle-images/vehicles/v1/' });
    expect(r2.calls[2].input.ContinuationToken).toBe('t1');
  });

  test('si falla la subida de la miniatura de catálogo, la imagen principal se guarda igual', async () => {
    Object.assign(process.env, R2_ENV);
    const sharp = require('sharp');
    const png = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 200, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const calls = [];
    setR2ClientForTests({
      async send(command) {
        calls.push(command.input.Key);
        if (/-thumb\./.test(command.input.Key)) throw new Error('R2 caído');
        return {};
      },
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const url = await uploadCatalogImageBuffer(fakeSupabase(), png, 'image/png');

    expect(url).toMatch(new RegExp(`^${R2_URL_PREFIX}/catalog-images/catalog/\\d+-[a-z0-9]+\\.\\w+$`));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/-thumb\./);
    expect(console.warn).toHaveBeenCalledWith(
      '[catalogImageStorage] no se pudo generar o subir miniatura:',
      'R2 caído',
    );
  });

  test('removePrefix en Supabase falla en vez de entrar en bucle si no borra nada', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ name: `stuck-${String(i).padStart(3, '0')}.webp` }));
    const supabase = fakeSupabase({ listResponses: [fullPage, fullPage] });
    await expect(removePrefix(supabase, 'vehicle-images', 'vehicles/v1', {})).rejects.toThrow(
      'No se pudo vaciar vehicle-images/vehicles/v1',
    );
  });
});
