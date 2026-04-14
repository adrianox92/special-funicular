const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { getTelegramBotTokenFromEnv, isTelegramBotConfigured } = require('./lib/telegramEnv');

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[WARN] SUPABASE_SERVICE_ROLE_KEY no está definida. Las operaciones de API keys y admin fallarán en tiempo de ejecución.',
  );
}

const _tgTokenLen = getTelegramBotTokenFromEnv().length;
if (isTelegramBotConfigured()) {
  console.log(`[CONFIG] Telegram: activo (token en env, ${_tgTokenLen} caracteres).`);
} else {
  console.warn(
    '[CONFIG] Telegram: desactivado — process.env no tiene TELEGRAM_BOT_TOKEN (ni TELEGRAM_TOKEN). En Render: añade la clave al Web Service de la API (no al Static Site del frontend), redeploy; evita comillas en el valor.',
  );
}

const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const {
  publicSignupLimiter,
  publicCatalogReadLimiter,
  authSoftLimiter,
  contactLimiter,
} = require('./middleware/rateLimits');

const app = express();

// Render (y otros reverse proxies) envían X-Forwarded-For; sin esto express-rate-limit
// lanza ERR_ERL_UNEXPECTED_X_FORWARDED_FOR y req.ip no refleja al cliente real.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  app.use(helmet());
} else {
  app.use(helmet({ contentSecurityPolicy: false }));
}

// Configuración de CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://special-funicular-bmy5.vercel.app',
  'https://special-funicular-bmy5-4tra1w9ef-adrians-projects-63dd797c.vercel.app',
  'https://slotdatabase.es',
  'https://www.slotdatabase.es',
];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL === origin) return true;
  return false;
}

// Rutas de sincronización (X-API-Key, solo GET/POST) — no necesitan PATCH ni DELETE.
const corsSyncOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Rutas autenticadas con JWT: todos los métodos incluyendo PATCH/PUT/DELETE.
const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') console.log('Origen bloqueado por CORS:', origin);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

function pickCorsOptions(path) {
  // /api/license-account/* comparte prefijo con /api/license pero es JWT + PATCH → corsOptions.
  if (path.startsWith('/api/license-account')) return corsOptions;
  if (
    path.startsWith('/api/sync') ||
    path === '/api/auth/api-key' ||
    path.startsWith('/api/license')
  ) return corsSyncOptions;
  return corsOptions;
}

// Aplicar CORS a todas las peticiones. Para preflights OPTIONS responde directamente
// antes de llegar a cualquier middleware de auth (que de lo contrario los bloquearía).
app.use((req, res, next) => {
  const corsMiddleware = cors(pickCorsOptions(req.path));
  if (req.method === 'OPTIONS') {
    corsMiddleware(req, res, () => res.sendStatus(204));
  } else {
    corsMiddleware(req, res, next);
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log('CORS Headers:', {
      origin: req.headers.origin,
      method: req.method,
      path: req.path,
    });
    next();
  });
}

app.use(express.json({ limit: '1mb' }));

const sitemapHandler = require('./routes/sitemap');
app.get('/sitemap.xml', sitemapHandler);

// ==================== RUTAS PÚBLICAS (SIN AUTENTICACIÓN) ====================
const publicCompetitionsRoute = require('./routes/publicCompetitions');
const publicPilotRoute = require('./routes/publicPilot');
const pilotProfileRoute = require('./routes/pilotProfile');
const contactRoute = require('./routes/contact');
const publicCatalogRoute = require('./routes/publicCatalog');
app.use('/api/public-signup', publicSignupLimiter, publicCompetitionsRoute);
app.use('/api/public/pilot', publicSignupLimiter, publicPilotRoute);
app.use('/api/public/catalog', publicCatalogReadLimiter, publicCatalogRoute);
app.use('/api/public/contact', contactLimiter, contactRoute);

// ==================== RUTAS PROTEGIDAS ====================
const vehiclesRoute = require('./routes/vehicles');
const timingsRoute = require('./routes/timings');
const dashboardRoute = require('./routes/dashboard');
const authRoute = require('./routes/auth');
const competitionRulesRoute = require('./routes/competition-rules');
const apiKeysRoute = require('./routes/api-keys');
const syncRoute = require('./routes/sync');
const circuitsRoute = require('./routes/circuits');
const maintenanceRoute = require('./routes/maintenance');
const searchRoute = require('./routes/search');
const inventoryRoute = require('./routes/inventory');
const apiKeyAuth = require('./middleware/apiKeyAuth');
const authMiddleware = require('./middleware/auth');
const licenseRoute = require('./routes/license');
const licenseAccountRoute = require('./routes/licenseAccount');
const helpRoute = require('./routes/help');
const catalogRoute = require('./routes/catalog');

app.use('/api/vehicles', vehiclesRoute);
app.use('/api/timings', timingsRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/sync', syncRoute);
app.use('/api/auth', authSoftLimiter, authRoute);
app.use('/api/license', apiKeyAuth, licenseRoute);
app.use('/api/license-account', authMiddleware, licenseAccountRoute);
app.use('/api/competition-rules', competitionRulesRoute);
app.use('/api/api-keys', apiKeysRoute);
app.use('/api/circuits', circuitsRoute);
app.use('/api/maintenance', maintenanceRoute);
app.use('/api/search', searchRoute);
app.use('/api/inventory', inventoryRoute);
app.use('/api/pilot-profile', pilotProfileRoute);
app.use('/api/help', helpRoute);
app.use('/api/catalog', catalogRoute);

const competitionsRoute = require('./routes/competitions');
app.use('/api/competitions', competitionsRoute);

if (process.env.NODE_ENV !== 'production') {
  const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
      title: 'Scalextric Collection API',
      version: '1.0.0',
      description: 'Documentación de la API para Scalextric Collection',
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Servidor local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  };

  const options = {
    swaggerDefinition,
    apis: ['./routes/*.js'],
  };

  const swaggerSpec = swaggerJSDoc(options);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

const PORT = process.env.PORT || 5001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

module.exports = app;
