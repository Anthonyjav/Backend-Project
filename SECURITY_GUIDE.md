# 🔒 GUÍA DE SEGURIDAD - Backend Proyecto

## ✅ Medidas de Seguridad Implementadas

### 1. **Helmet** - Headers de Seguridad HTTP
```javascript
app.use(helmet());
```
- Protege contra XSS, Clickjacking, MIME sniffing
- Establece headers de seguridad automáticamente

### 2. **Rate Limiting** - Prevención de Ataques de Fuerza Bruta
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 peticiones por IP
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // máximo 5 intentos de login
  skipSuccessfulRequests: true
});
```
- Limita peticiones por IP
- Protege endpoints sensibles (login)

### 3. **Autenticación JWT**
- Todas las rutas sensibles requieren token JWT
- Token en header: `Authorization: Bearer <token>`
- Token almacenado en `.env` (nunca en código)

### 4. **CORS Configurado**
- Whitelist de dominios permitidos
- Solo `GET, POST, PUT, DELETE`
- Require credenciales

### 5. **Morgan** - Logging de Peticiones
```javascript
app.use(morgan('combined'));
```
- Registra todas las peticiones (IP, método, ruta, estado)
- Útil para auditoría y detección de anomalías

### 6. **Validación de Inputs**
- Middleware `validateInputs.js` previene inyección SQL y XSS
- Valida tipos de datos, rangos, formatos
- Sanitiza strings automáticamente

---

## 🔐 Rutas Protegidas (Requieren JWT)

```
🔐 GET/POST/PUT/DELETE /carrito
🔐 GET/POST/PUT/DELETE /carritoitem
🔐 GET/POST/PUT/DELETE /ordenes
🔐 GET/POST/PUT/DELETE /orden-items
🔐 GET/POST/PUT/DELETE /reclamos
```

**Cómo usar:**
```javascript
// En Frontend
const token = localStorage.getItem('jwt_token');
fetch('http://localhost:3005/carrito', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 🌍 Rutas Públicas (Sin autenticación)

```
✅ POST /usuarios/login
✅ POST /usuarios/registro
✅ GET /productos
✅ GET /categorias
✅ POST /api/izipay/form-token
✅ POST /api/izipay/webhook
```

---

## 📋 Cómo Usar Validación de Inputs

### Ejemplo en ruta de login:
```javascript
const { body, validationResult } = require('express-validator');
const { validators, handleValidationErrors } = require('../middlewares/validateInputs');

router.post('/login', [
  validators.email,
  validators.password,
  handleValidationErrors
], async (req, res) => {
  // ... código de login
});
```

### Ejemplo en ruta de crear producto:
```javascript
router.post('/crear', [
  validators.nombre,
  validators.precio,
  validators.cantidad,
  handleValidationErrors
], async (req, res) => {
  // ... código seguro
});
```

---

## 🚨 Gestión de Errores

Todos los errores son capturados por el middleware global:
```javascript
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
```

---

## 📝 Variables de Entorno (.env)

```env
# Seguridad
JWT_SECRET=tu_clave_secreta_fuerte_aqui
IZIPAY_USER=tu_usuario
IZIPAY_PASS=tu_password
IZIPAY_HMAC=tu_hmac_key

# Base de Datos
DATABASE_URL=postgresql://...

# API
PORT=10000
NODE_ENV=production

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Frontend
FRONTEND_URL=https://sgstudio.shop
```

---

## ✅ CHECKLIST de Seguridad

- [x] Helmet instalado y configurado
- [x] Rate limiting implementado
- [x] JWT para rutas sensibles
- [x] CORS restringido a dominios permitidos
- [x] Morgan para logging
- [x] Validación de inputs
- [x] Credenciales en `.env`
- [ ] **TODO**: Agregar HTTPS en producción
- [ ] **TODO**: Configurar CSRF protection (si uses formularios)
- [ ] **TODO**: Implementar 2FA para admin
- [ ] **TODO**: Auditoría regular de logs
- [ ] **TODO**: Actualizar dependencias regularmente (`npm audit`)

---

## 🔄 Próximos Pasos Recomendados

1. **Implementar en todas las rutas:** Agregar `loginLimiter` a endpoint de login
2. **Validación de inputs:** Aplicar validadores a todas las rutas
3. **HTTPS:** En producción, usa HTTPS (no HTTP)
4. **Secrets rotation:** Rota JWT_SECRET periódicamente
5. **Monitoreo:** Configura alertas para patrones sospechosos en logs

---

## 🆘 Contacto/Soporte

Si encuentras vulnerabilidades o problemas de seguridad, reporta inmediatamente.

