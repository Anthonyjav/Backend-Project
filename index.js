const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./models');
require('dotenv').config();
const path = require('path');

// Middleware JSON
app.use(express.json());

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

// Rutas
app.use('/usuarios', require('./routes/usuarios'));
app.use('/productos', require('./routes/producto'));
app.use('/categorias', require('./routes/categoria'));
app.use('/carrito', require('./routes/carrito'));
app.use('/carritoitem', require('./routes/carritoitem')); // corregido typo
app.use('/ordenes', require('./routes/orden'));
app.use('/orden-items', require('./routes/ordenItem'));
app.use('/reclamos', require('./routes/reclamo'));

// Puerto
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
