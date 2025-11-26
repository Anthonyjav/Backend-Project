const express = require('express');
const router = express.Router();
const { Usuario } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');

/* ============================
   ⚠️ RATE LIMITERS
   ============================ */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos
  message: 'Demasiados intentos de login. Intenta en 15 minutos.',
  skipSuccessfulRequests: true, // no cuenta intentos exitosos
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por IP
  message: 'Demasiados registros. Intenta más tarde.',
});

/* ============================
   ✅ VALIDADORES
   ============================ */
const validarEmail = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Email inválido');

const validarPassword = body('password')
  .isLength({ min: 8 })
  .withMessage('La contraseña debe tener al menos 8 caracteres')
  .matches(/[A-Z]/)
  .withMessage('La contraseña debe incluir al menos una mayúscula')
  .matches(/[0-9]/)
  .withMessage('La contraseña debe incluir al menos un número');

const validarNombre = body('nombre')
  .trim()
  .isLength({ min: 2, max: 50 })
  .withMessage('El nombre debe tener entre 2 y 50 caracteres')
  .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
  .withMessage('El nombre solo puede contener letras y espacios');

const validarApellido = body('apellido')
  .trim()
  .isLength({ min: 2, max: 50 })
  .withMessage('El apellido debe tener entre 2 y 50 caracteres')
  .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
  .withMessage('El apellido solo puede contener letras y espacios');

// Función para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: errors.array().map(e => ({ field: e.param, message: e.msg }))
    });
  }
  next();
};

/* ============================
   📝 REGISTRO (Público)
   ============================ */
router.post('/registro', registroLimiter, [
  validarNombre,
  validarApellido,
  validarEmail,
  validarPassword,
  handleValidationErrors
], async (req, res) => {
  try {
    const { nombre, apellido, email, password } = req.body;

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({
      where: { email: email.toLowerCase() }
    });

    if (usuarioExistente) {
      return res.status(409).json({
        error: 'Ya existe un usuario con este email'
      });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const nuevoUsuario = await Usuario.create({
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      rol: 'cliente'
    });

    // NO devolver contraseña
    const { password: _, ...usuarioSinPassword } = nuevoUsuario.toJSON();

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      usuario: usuarioSinPassword
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

/* ============================
   🔐 LOGIN (Público con Rate Limit)
   ============================ */
router.post('/login', loginLimiter, [
  validarEmail,
  validarPassword,
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const usuario = await Usuario.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!usuario) {
      return res.status(401).json({
        error: 'Email o contraseña incorrectos'
      });
    }

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({
        error: 'Email o contraseña incorrectos'
      });
    }

    // Generar JWT (válido por 24 horas)
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // NO devolver contraseña
    const { password: _, ...usuarioSinPassword } = usuario.toJSON();

    res.json({
      message: 'Login exitoso',
      token,
      usuario: usuarioSinPassword
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/* ============================
   👤 OBTENER PERFIL (Protegido)
   ============================ */
router.get('/perfil', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { password: _, ...usuarioSinPassword } = usuario.toJSON();
    res.json(usuarioSinPassword);

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

/* ============================
   ✏️ ACTUALIZAR PERFIL (Protegido)
   ============================ */
router.put('/perfil', auth, [
  body('nombre').optional().trim().isLength({ min: 2, max: 50 }),
  body('apellido').optional().trim().isLength({ min: 2, max: 50 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { nombre, apellido } = req.body;
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar solo campos permitidos
    if (nombre) usuario.nombre = nombre.trim();
    if (apellido) usuario.apellido = apellido.trim();

    await usuario.save();

    const { password: _, ...usuarioSinPassword } = usuario.toJSON();

    res.json({
      message: 'Perfil actualizado exitosamente',
      usuario: usuarioSinPassword
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

/* ============================
   🔑 CAMBIAR CONTRASEÑA (Protegido)
   ============================ */
router.put('/cambiar-password', auth, [
  body('passwordActual').notEmpty().withMessage('La contraseña actual es requerida'),
  validarPassword,
  handleValidationErrors
], async (req, res) => {
  try {
    const { passwordActual, password } = req.body;
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const passwordValida = await bcrypt.compare(passwordActual, usuario.password);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    // Hashear nueva contraseña
    usuario.password = await bcrypt.hash(password, 10);
    await usuario.save();

    res.json({ message: 'Contraseña actualizada exitosamente' });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

/* ============================
   👥 LISTAR USUARIOS (Público - Información pública)
   ============================ */
router.get('/', async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: ['id', 'nombre', 'apellido', 'email']
    });

    res.json(usuarios);

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

/* ============================
   👤 OBTENER USUARIO POR ID (Público)
   ============================ */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findByPk(id, {
      attributes: ['id', 'nombre', 'apellido', 'email']
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(usuario);

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
});

/* ============================
   ✏️ EDITAR USUARIO (Protegido - Solo admin o el usuario mismo)
   ============================ */
router.put('/:id', auth, [
  body('nombre').optional().trim().isLength({ min: 2, max: 50 }),
  body('apellido').optional().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email } = req.body;

    // Validar que el usuario solo pueda editar su propio perfil
    if (req.user.id !== parseInt(id) && req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para editar este usuario'
      });
    }

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar solo campos permitidos
    if (nombre) usuario.nombre = nombre.trim();
    if (apellido) usuario.apellido = apellido.trim();
    if (email) {
      // Verificar que el email no esté en uso
      const emailExistente = await Usuario.findOne({
        where: { email: email.toLowerCase(), id: { [require('sequelize').Op.ne]: id } }
      });

      if (emailExistente) {
        return res.status(409).json({ error: 'Este email ya está en uso' });
      }

      usuario.email = email.toLowerCase();
    }

    await usuario.save();

    const { password: _, ...usuarioSinPassword } = usuario.toJSON();

    res.json({
      message: 'Usuario actualizado exitosamente',
      usuario: usuarioSinPassword
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

/* ============================
   🗑️ ELIMINAR USUARIO (Protegido - Solo admin o el usuario mismo)
   ============================ */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Validar que solo admin pueda eliminar otros usuarios
    if (req.user.id !== parseInt(id) && req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para eliminar este usuario'
      });
    }

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await usuario.destroy();

    res.json({ message: 'Usuario eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
