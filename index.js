const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./models');
require('dotenv').config();
const path = require('path');
const izipayRouter = require('./routes/izipay');
const auth = require('./middlewares/auth');

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

// Sincronización DB
db.sequelize.sync()
  .then(() => console.log('Conectado y sincronizado con la base de datos'))
  .catch(err => console.error('Error DB:', err));

// ✅ RUTAS PÚBLICAS (sin autenticación)
app.use('/usuarios', require('./routes/usuarios')); // Login/Registro aquí
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

// Puerto
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
