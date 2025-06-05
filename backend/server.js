const express = require('express');
const cors = require('cors');
require('dotenv').config();

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

const vehiclesRoute = require('./routes/vehicles');
const timingsRoute = require('./routes/timings');
const dashboardRoute = require('./routes/dashboard');

app.use('/api/vehicles', vehiclesRoute);
app.use('/api/timings', timingsRoute);
app.use('/api/dashboard', dashboardRoute);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
