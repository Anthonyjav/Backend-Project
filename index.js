const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const app = express();
const db = require('./models');
require('dotenv').config();
const path = require('path');
const auth = require('./middlewares/auth');

/* ============================
   🔒 MIDDLEWARES DE SEGURIDAD
   ============================ */

// 1️⃣ Helmet: Headers de seguridad HTTP
app.use(helmet());

// 2️⃣ Morgan: Logging de peticiones
app.use(morgan('combined'));

// 3️⃣ Rate Limiting: Prevenir ataques de fuerza bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 peticiones por IP en 15 min
  message: 'Demasiadas peticiones desde esta IP, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit más estricto para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login
  message: 'Demasiados intentos de login, intenta en 15 minutos',
  skipSuccessfulRequests: true, // no cuenta intentos exitosos
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));


// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de CORS
const whitelist = [
  'https://sgstudio.shop',
  'https://www.sgstudio.shop',
  'http://localhost:3000',
  'https://sgstudio.shop/'
];


const corsOptions = {
  origin: function (origin, callback) {
    // Permite requests sin origin (ej: Postman)
    if (!origin) return callback(null, true);

    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true // permite cookies/autenticación
};

app.use(cors(corsOptions));

// 4️⃣ Rate limiter global para todas las rutas
app.use(limiter);

// Sincronización DB
db.sequelize.sync()
  .then(() => console.log('Conectado y sincronizado con la base de datos'))
  .catch(err => console.error('Error DB:', err));

// ✅ RUTAS PÚBLICAS (sin autenticación)
app.use('/usuarios', require('./routes/usuarios')); // Login/Registro con rate limit
app.use('/productos', require('./routes/producto')); // Listar productos es público
app.use('/categorias', require('./routes/categoria')); // Listar categorías es público
app.use('/api/izipay', require('./routes/izipay')); // Webhook de Izipay debe ser público

// 🔐 RUTAS PROTEGIDAS (requieren autenticación)
app.use('/carrito', auth, require('./routes/carrito'));
app.use('/carritoitem', auth, require('./routes/carritoitem')); 
app.use('/ordenes', auth, require('./routes/orden'));
app.use('/orden-items', auth, require('./routes/ordenItem'));
app.use('/reclamos', auth, require('./routes/reclamo'));
app.use('/', require('./routes/adminAnalytics')); // Revisar si debe ser protegida

// ⚠️ Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Puerto
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
