const express = require('express');
const router = express.Router();
const { Orden, OrdenItem, Usuario, Producto } = require('../models');
const { body, param, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');

/* ============================
   ✅ VALIDADORES
   ============================ */
const validarOrden = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),

  body('apellido')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),

  body('telefono')
    .optional()
    .trim()
    .isLength({ min: 7, max: 15 })
    .withMessage('El teléfono debe tener entre 7 y 15 caracteres'),

  body('pais')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('País inválido'),

  body('departamento')
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body('provincia')
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body('distrito')
    .optional()
    .trim()
    .isLength({ max: 50 }),

  body('direccion')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('La dirección debe tener entre 5 y 200 caracteres'),

  body('referencia')
    .optional()
    .trim()
    .isLength({ max: 100 }),

  body('metodoEnvio')
    .optional()
    .trim(),

  body('subtotal')
    .isFloat({ min: 0 })
    .withMessage('Subtotal debe ser un número válido'),

  body('envio')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Envío debe ser un número válido'),

  body('total')
    .isFloat({ min: 0.01 })
    .withMessage('Total debe ser mayor a 0'),

  body('estado')
    .optional()
    .isIn(['pendiente', 'procesando', 'pagado', 'enviado', 'entregado', 'cancelado'])
    .withMessage('Estado inválido')
];

const validarID = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número válido')
];

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
   📋 OBTENER TODAS LAS ÓRDENES (Protegido)
   ============================ */
router.get('/', auth, async (req, res) => {
  try {
    let ordenes;

    // Si es admin, obtener todas las órdenes
    if (req.user.rol === 'admin') {
      ordenes = await Orden.findAll({
        include: [
          {
            model: OrdenItem,
            as: 'items'
          },
          {
            model: Usuario,
            as: 'usuario',
            attributes: ['id', 'nombre', 'apellido', 'email']
          }
        ],
        order: [['createdAt', 'DESC']]
      });
    } else {
      // Si es cliente, obtener solo sus órdenes
      ordenes = await Orden.findAll({
        where: { usuarioId: req.user.id },
        include: [
          {
            model: OrdenItem,
            as: 'items'
          }
        ],
        order: [['createdAt', 'DESC']]
      });
    }

    res.json(ordenes);

  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
});

/* ============================
   🔍 OBTENER ORDEN POR ID (Protegido)
   ============================ */
router.get('/:id', auth, validarID, handleValidationErrors, async (req, res) => {
  try {
    const orden = await Orden.findByPk(req.params.id, {
      include: [
        {
          model: OrdenItem,
          as: 'items',
          include: [
            {
              model: Producto,
              as: 'producto',
              attributes: ['id', 'nombre', 'precio', 'descripcion']
            }
          ]
        },
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'apellido', 'email']
        }
      ]
    });

    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Validar permisos: cliente solo ve su orden, admin ve todas
    if (orden.usuarioId !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para ver esta orden'
      });
    }

    res.json(orden);

  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({ error: 'Error al obtener la orden' });
  }
});

/* ============================
   ➕ CREAR ORDEN (Protegido)
   ============================ */
router.post('/', auth, validarOrden, handleValidationErrors, async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      email,
      telefono,
      pais,
      departamento,
      provincia,
      distrito,
      direccion,
      referencia,
      metodoEnvio,
      subtotal,
      envio,
      total,
      estado,
      items
    } = req.body;

    // Crear la orden
    const nuevaOrden = await Orden.create({
      usuarioId: req.user.id, // Asociar al usuario autenticado
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.toLowerCase(),
      telefono: telefono ? telefono.trim() : null,
      pais: pais.trim(),
      departamento: departamento ? departamento.trim() : null,
      provincia: provincia ? provincia.trim() : null,
      distrito: distrito ? distrito.trim() : null,
      direccion: direccion.trim(),
      referencia: referencia ? referencia.trim() : null,
      metodoEnvio: metodoEnvio ? metodoEnvio.trim() : null,
      subtotal: parseFloat(subtotal),
      envio: envio ? parseFloat(envio) : 0,
      total: parseFloat(total),
      estado: estado || 'pendiente'
    });

    // Crear items si los hay
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        // Validar que el producto existe
        const producto = await Producto.findByPk(item.productoId);
        if (!producto) {
          await nuevaOrden.destroy();
          return res.status(404).json({
            error: `Producto con ID ${item.productoId} no encontrado`
          });
        }

        await OrdenItem.create({
          ordenId: nuevaOrden.id,
          productoId: item.productoId,
          nombreProducto: item.nombreProducto || producto.nombre,
          cantidad: parseInt(item.cantidad),
          precio: parseFloat(item.precio),
          talla: item.talla ? item.talla.trim() : null
        });
      }
    }

    // Retornar orden completa
    const ordenCompleta = await Orden.findByPk(nuevaOrden.id, {
      include: [
        {
          model: OrdenItem,
          as: 'items'
        }
      ]
    });

    res.status(201).json({
      message: 'Orden creada exitosamente',
      orden: ordenCompleta
    });

  } catch (error) {
    console.error('Error al crear orden:', error);
    res.status(500).json({ error: 'Error al crear la orden' });
  }
});

/* ============================
   ✏️ ACTUALIZAR ORDEN (Protegido - Solo admin o dueño)
   ============================ */
router.put('/:id', auth, validarID, [
  body('estado')
    .optional()
    .isIn(['pendiente', 'procesando', 'pagado', 'enviado', 'entregado', 'cancelado'])
    .withMessage('Estado inválido'),
  body('subtotal').optional().isFloat({ min: 0 }),
  body('envio').optional().isFloat({ min: 0 }),
  body('total').optional().isFloat({ min: 0.01 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const orden = await Orden.findByPk(req.params.id);

    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Validar permisos
    if (orden.usuarioId !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para editar esta orden'
      });
    }

    // Clientes solo pueden actualizar ciertos campos
    if (req.user.rol !== 'admin') {
      const { referencia, metodoEnvio } = req.body;
      if (referencia) orden.referencia = referencia.trim();
      if (metodoEnvio) orden.metodoEnvio = metodoEnvio.trim();
    } else {
      // Admin puede actualizar todos los campos
      const { subtotal, envio, total, estado } = req.body;
      if (subtotal !== undefined) orden.subtotal = parseFloat(subtotal);
      if (envio !== undefined) orden.envio = parseFloat(envio);
      if (total !== undefined) orden.total = parseFloat(total);
      if (estado) orden.estado = estado;
    }

    await orden.save();

    res.json({
      message: 'Orden actualizada exitosamente',
      orden
    });

  } catch (error) {
    console.error('Error al actualizar orden:', error);
    res.status(500).json({ error: 'Error al actualizar la orden' });
  }
});

/* ============================
   🗑️ ELIMINAR ORDEN (Protegido - Solo admin)
   ============================ */
router.delete('/:id', auth, validarID, handleValidationErrors, async (req, res) => {
  try {
    // Solo admin puede eliminar órdenes
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para eliminar órdenes'
      });
    }

    const orden = await Orden.findByPk(req.params.id);

    if (!orden) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Eliminar items relacionados
    await OrdenItem.destroy({ where: { ordenId: orden.id } });

    // Eliminar orden
    await orden.destroy();

    res.json({ message: 'Orden eliminada correctamente' });

  } catch (error) {
    console.error('Error al eliminar orden:', error);
    res.status(500).json({ error: 'Error al eliminar la orden' });
  }
});

module.exports = router;