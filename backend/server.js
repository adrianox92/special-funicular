const express = require('express');
const cors = require('cors');
require('dotenv').config();
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const app = express();

// Configuración de CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', 
  'https://special-funicular-bmy5.vercel.app',
  'https://special-funicular-bmy5-4tra1w9ef-adrians-projects-63dd797c.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir solicitudes sin origen (como las de Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.FRONTEND_URL === origin) {
      callback(null, true);
    } else {
      console.log('Origen bloqueado por CORS:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// CORS permisivo para /api/sync: protegido por X-API-Key, cualquier origen permitido
const corsSyncOptions = {
  origin: true, // Refleja el origen de la petición (permite cualquier origen)
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// CORS: permisivo para /api/sync y /api/auth/api-key (protegido por credenciales/API key), restrictivo para el resto
app.use((req, res, next) => {
  const isPublicApiRoute = req.path.startsWith('/api/sync') || req.path === '/api/auth/api-key';
  cors(isPublicApiRoute ? corsSyncOptions : corsOptions)(req, res, next);
});

// Middleware para logging de CORS (ayuda en debugging)
app.use((req, res, next) => {
  console.log('CORS Headers:', {
    origin: req.headers.origin,
    method: req.method,
    path: req.path
  });
  next();
});

app.use(express.json());

// ==================== RUTAS PÚBLICAS (SIN AUTENTICACIÓN) ====================
// IMPORTANTE: Montar las rutas públicas PRIMERO para que tengan prioridad absoluta
const publicCompetitionsRoute = require('./routes/publicCompetitions');
app.use('/api/public-signup', publicCompetitionsRoute);

// ==================== RUTAS PROTEGIDAS ====================
const vehiclesRoute = require('./routes/vehicles');
const timingsRoute = require('./routes/timings');
const dashboardRoute = require('./routes/dashboard');
const insightsRoute = require('./routes/insights');
const authRoute = require('./routes/auth');
const competitionRulesRoute = require('./routes/competition-rules');
const apiKeysRoute = require('./routes/api-keys');
const syncRoute = require('./routes/sync');
const circuitsRoute = require('./routes/circuits');
const maintenanceRoute = require('./routes/maintenance');
const inventoryRoute = require('./routes/inventory');

app.use('/api/vehicles', vehiclesRoute);
app.use('/api/timings', timingsRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/sync', syncRoute);  // ANTES de /api (insights): sync usa X-API-Key, no JWT
// ANTES de app.use('/api', insights): insights aplica JWT a todo lo bajo /api; si auth va después,
// POST /api/auth/login y POST /api/auth/api-key nunca llegan aquí (401 sin token).
app.use('/api/auth', authRoute);
app.use('/api', insightsRoute);
app.use('/api/competition-rules', competitionRulesRoute);
app.use('/api/api-keys', apiKeysRoute);
app.use('/api/circuits', circuitsRoute);
app.use('/api/maintenance', maintenanceRoute);
app.use('/api/inventory', inventoryRoute);

// Montar las rutas protegidas DESPUÉS
const competitionsRoute = require('./routes/competitions');
app.use('/api/competitions', competitionsRoute);

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
      bearerAuth: []
    }
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js'], // Puedes ajustar esto según la ubicación de tus rutas
};

const swaggerSpec = swaggerJSDoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));