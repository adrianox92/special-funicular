const express = require('express');
const cors = require('cors');
require('dotenv').config();
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

const app = express();

// Configuración de CORS
const allowedOrigins = [
  'http://localhost:3000',
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
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Aplicar CORS antes de otras rutas
app.use(cors(corsOptions));

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

app.use('/api/vehicles', vehiclesRoute);
app.use('/api/timings', timingsRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api', insightsRoute);
app.use('/api/auth', authRoute);

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
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));