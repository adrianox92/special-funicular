/**
 * Marca y modelo del coche real a partir de `model_name`.
 * La marca de slot sigue en `manufacturer`.
 * Si el nombre no empieza por una marca conocida, ambos campos quedan vacíos.
 */

/** @type {{ alias: string, canonical: string }[]} */
const BRAND_ALIASES = [
  ['alfa romeo', 'Alfa Romeo'],
  ['alfa', 'Alfa Romeo'],
  ['aston martin', 'Aston Martin'],
  ['aston', 'Aston Martin'],
  ['mercedes benz', 'Mercedes'],
  ['mercedes', 'Mercedes'],
  ['mb', 'Mercedes'],
  ['land rover', 'Land Rover'],
  ['range rover', 'Range Rover'],
  ['rolls royce', 'Rolls-Royce'],
  ['volkswagen', 'Volkswagen'],
  ['vw', 'Volkswagen'],
  ['chevrolet', 'Chevrolet'],
  ['chevy', 'Chevrolet'],
  ['citroen', 'Citroën'],
  ['mclaren', 'McLaren'],
  ['mc laren', 'McLaren'],
  ['lamborghini', 'Lamborghini'],
  ['mitsubishi', 'Mitsubishi'],
  ['porsche', 'Porsche'],
  ['ferrari', 'Ferrari'],
  ['renault', 'Renault'],
  ['peugeot', 'Peugeot'],
  ['toyota', 'Toyota'],
  ['lancia', 'Lancia'],
  ['jaguar', 'Jaguar'],
  ['nissan', 'Nissan'],
  ['subaru', 'Subaru'],
  ['maserati', 'Maserati'],
  ['pagani', 'Pagani'],
  ['bugatti', 'Bugatti'],
  ['bentley', 'Bentley'],
  ['lotus', 'Lotus'],
  ['mosler', 'Mosler'],
  ['marcos', 'Marcos'],
  ['dodge', 'Dodge'],
  ['honda', 'Honda'],
  ['mazda', 'Mazda'],
  ['volvo', 'Volvo'],
  ['hyundai', 'Hyundai'],
  ['suzuki', 'Suzuki'],
  ['cupra', 'Cupra'],
  ['skoda', 'Škoda'],
  ['dacia', 'Dacia'],
  ['dallara', 'Dallara'],
  ['lola', 'Lola'],
  ['opel', 'Opel'],
  ['fiat', 'Fiat'],
  ['abarth', 'Abarth'],
  ['jeep', 'Jeep'],
  ['chrysler', 'Chrysler'],
  ['cadillac', 'Cadillac'],
  ['pontiac', 'Pontiac'],
  ['plymouth', 'Plymouth'],
  ['buick', 'Buick'],
  ['lincoln', 'Lincoln'],
  ['tesla', 'Tesla'],
  ['smart', 'Smart'],
  ['mini', 'MINI'],
  ['seat', 'SEAT'],
  ['bmw', 'BMW'],
  ['audi', 'Audi'],
  ['au', 'Audi'],
  ['ford', 'Ford'],
  ['man', 'MAN'],
  ['mg', 'MG'],
  ['tvr', 'TVR'],
  ['kia', 'Kia'],
].map(([alias, canonical]) => ({ alias, canonical }));

BRAND_ALIASES.sort((a, b) => b.alias.length - a.alias.length);

/** El nombre empieza por el modelo y la marca no está escrita. */
const LEADING_MODELS = [
  { token: 'corvette', make: 'Chevrolet', model: 'Corvette' },
  { token: 'camaro', make: 'Chevrolet', model: 'Camaro' },
  { token: 'mustang', make: 'Ford', model: 'Mustang' },
];

const SERIES_PREFIX = new Set(['rs', 'r', 'gt', 'gtr', 'amg', 'mk', 'm']);

function normalizeIdentityText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function displayPart(part) {
  if (/\d/.test(part) || part.length <= 2 || SERIES_PREFIX.has(part)) return part.toUpperCase();
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function displayModel(text) {
  return String(text)
    .split(' ')
    .filter(Boolean)
    .map(displayPart)
    .join(' ');
}

function isShortCode(token) {
  return /^\d+[a-z]?$/.test(token) || token.length <= 4;
}

function modelFromTokens(tokens) {
  if (!tokens.length) return null;
  let raw = tokens[0];
  if (SERIES_PREFIX.has(tokens[0]) && tokens[1] && isShortCode(tokens[1])) {
    raw = tokens[0].length === 1 && /^\d+$/.test(tokens[1])
      ? `${tokens[0]}${tokens[1]}`
      : `${tokens[0]} ${tokens[1]}`;
  }
  const model = displayModel(raw);
  return model || null;
}

function matchLeadingBrand(normalized) {
  for (const brand of BRAND_ALIASES) {
    if (normalized === brand.alias || normalized.startsWith(`${brand.alias} `)) {
      return {
        canonical: brand.canonical,
        rest: normalized.slice(brand.alias.length).trim(),
      };
    }
  }
  return null;
}

/**
 * @param {unknown} modelName
 * @returns {{ car_make: string|null, car_model: string|null }}
 */
function extractCatalogCarIdentity(modelName) {
  const normalized = normalizeIdentityText(modelName);
  if (!normalized) return { car_make: null, car_model: null };

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens[0] === 'f' && /^\d{3}/.test(tokens[1] || '')) {
    return { car_make: 'Ferrari', car_model: modelFromTokens(tokens.slice(1)) };
  }
  if (/^f\d{3}/.test(tokens[0])) {
    return { car_make: 'Ferrari', car_model: displayModel(tokens[0].slice(1)) };
  }

  const leading = LEADING_MODELS.find(
    (entry) => normalized === entry.token || normalized.startsWith(`${entry.token} `),
  );
  if (leading) return { car_make: leading.make, car_model: leading.model };

  const brand = matchLeadingBrand(normalized);
  if (!brand) return { car_make: null, car_model: null };

  return {
    car_make: brand.canonical,
    car_model: modelFromTokens(brand.rest.split(' ').filter(Boolean)),
  };
}

/**
 * Columnas a escribir. `null` si la ficha está corregida a mano.
 * @param {unknown} modelName
 * @param {string|null|undefined} existingSource
 * @returns {{ car_make: string|null, car_model: string|null, car_identity_source: 'auto' }|null}
 */
function catalogCarIdentityColumns(modelName, existingSource) {
  if (existingSource === 'manual') return null;
  const identity = extractCatalogCarIdentity(modelName);
  return {
    car_make: identity.car_make,
    car_model: identity.car_model,
    car_identity_source: 'auto',
  };
}

module.exports = {
  extractCatalogCarIdentity,
  catalogCarIdentityColumns,
  normalizeIdentityText,
};
