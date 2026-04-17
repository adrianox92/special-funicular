const { buildTrackedUrl } = require('../../lib/affiliateUrl');

const baseSeller = {
  user_id: 'user-uuid-123',
  default_utm_source: 'slotdb',
  default_utm_medium: 'catalog',
  affiliate_param_template: null,
};

const baseListing = {
  id: 'list-uuid-456',
  url: 'https://tienda.example.com/producto',
  custom_utm_campaign: null,
};

describe('buildTrackedUrl', () => {
  it('añade parámetros UTM básicos', () => {
    const result = buildTrackedUrl(baseListing, baseSeller);
    const u = new URL(result);
    expect(u.searchParams.get('utm_source')).toBe('slotdb');
    expect(u.searchParams.get('utm_medium')).toBe('catalog');
    expect(u.searchParams.get('utm_campaign')).toBe('listing_list-uuid-456');
    expect(u.searchParams.get('utm_content')).toBe('user-uuid-123');
  });

  it('usa custom_utm_campaign cuando está presente', () => {
    const listing = { ...baseListing, custom_utm_campaign: 'verano-2026' };
    const result = buildTrackedUrl(listing, baseSeller);
    const u = new URL(result);
    expect(u.searchParams.get('utm_campaign')).toBe('verano-2026');
  });

  it('NO sobreescribe utm_source ya presente en la URL', () => {
    const listing = { ...baseListing, url: 'https://tienda.example.com/?utm_source=ya_existe' };
    const result = buildTrackedUrl(listing, baseSeller);
    const u = new URL(result);
    expect(u.searchParams.get('utm_source')).toBe('ya_existe');
    expect(u.searchParams.get('utm_medium')).toBe('catalog');
  });

  it('NO sobreescribe utm_medium ni utm_campaign ya presentes', () => {
    const listing = {
      ...baseListing,
      url: 'https://tienda.example.com/?utm_medium=email&utm_campaign=promo',
    };
    const result = buildTrackedUrl(listing, baseSeller);
    const u = new URL(result);
    expect(u.searchParams.get('utm_medium')).toBe('email');
    expect(u.searchParams.get('utm_campaign')).toBe('promo');
    expect(u.searchParams.get('utm_source')).toBe('slotdb');
  });

  it('añade parámetro de afiliado desde affiliate_param_template', () => {
    const seller = { ...baseSeller, affiliate_param_template: 'aff=XYZ123' };
    const result = buildTrackedUrl(baseListing, seller);
    const u = new URL(result);
    expect(u.searchParams.get('aff')).toBe('XYZ123');
  });

  it('NO duplica parámetro de afiliado si ya existe en la URL', () => {
    const seller = { ...baseSeller, affiliate_param_template: 'tag=mi-tag' };
    const listing = { ...baseListing, url: 'https://amazon.es/dp/B001?tag=ya-existe' };
    const result = buildTrackedUrl(listing, seller);
    const u = new URL(result);
    expect(u.searchParams.get('tag')).toBe('ya-existe');
  });

  it('preserva el hash (#fragment) de la URL original', () => {
    const listing = { ...baseListing, url: 'https://tienda.example.com/prod#descripcion' };
    const result = buildTrackedUrl(listing, baseSeller);
    expect(result).toContain('#descripcion');
  });

  it('devuelve la URL sin modificar si está malformada', () => {
    const listing = { ...baseListing, url: 'no-es-una-url-valida' };
    const result = buildTrackedUrl(listing, baseSeller);
    expect(result).toBe('no-es-una-url-valida');
  });

  it('devuelve cadena vacía si no hay url', () => {
    expect(buildTrackedUrl({ id: 'x', url: null }, baseSeller)).toBe('');
    expect(buildTrackedUrl({}, baseSeller)).toBe('');
  });

  it('funciona sin seller (seller=null)', () => {
    const result = buildTrackedUrl(baseListing, null);
    const u = new URL(result);
    expect(u.searchParams.get('utm_source')).toBe('slotdb');
    expect(u.searchParams.get('utm_content')).toBeNull();
  });

  it('ignora affiliate_param_template malformado (sin =)', () => {
    const seller = { ...baseSeller, affiliate_param_template: 'sinigualvalor' };
    const result = buildTrackedUrl(baseListing, seller);
    const u = new URL(result);
    expect(u.searchParams.has('sinigualvalor')).toBe(false);
  });

  it('maneja URL con parámetros y hash existentes', () => {
    const listing = {
      ...baseListing,
      url: 'https://tienda.example.com/prod?color=rojo&talla=M#fotos',
    };
    const seller = { ...baseSeller, affiliate_param_template: 'ref=slotdb' };
    const result = buildTrackedUrl(listing, seller);
    const u = new URL(result);
    expect(u.searchParams.get('color')).toBe('rojo');
    expect(u.searchParams.get('talla')).toBe('M');
    expect(u.searchParams.get('ref')).toBe('slotdb');
    expect(u.hash).toBe('#fotos');
  });
});
