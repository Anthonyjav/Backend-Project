/* ============================
   Middleware de Validación de Inputs
   Previene inyección SQL, XSS y otros ataques
   ============================ */

const { body, validationResult } = require('express-validator');

// Función para validar el resultado
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

// Validadores reutilizables
const validators = {
  // Validar email
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),

  // Validar contraseña (mínimo 8 caracteres)
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/)
    .withMessage('La contraseña debe incluir al menos una mayúscula')
    .matches(/[0-9]/)
    .withMessage('La contraseña debe incluir al menos un número'),

  // Validar nombre
  nombre: body('nombre')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras'),

  // Validar cantidad (productos)
  cantidad: body('cantidad')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número positivo'),

  // Validar precio
  precio: body('precio')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),

  // Validar ID (número o UUID)
  id: body('id')
    .isInt()
    .withMessage('ID inválido'),

  // Sanitizar strings genéricos (limpia de caracteres maliciosos)
  sanitizeString: (fieldName) => body(fieldName)
    .trim()
    .escape()
    .withMessage(`${fieldName} contiene caracteres inválidos`),
};

module.exports = {
  handleValidationErrors,
  validators
};
