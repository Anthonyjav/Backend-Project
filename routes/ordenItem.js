const express = require('express');
const router = express.Router();
const { Orden, OrdenItem, Producto } = require('../models');
const { body, param, validationResult, query } = require('express-validator');
const auth = require('../middlewares/auth');

/* ============================
   ✅ VALIDADORES
   ============================ */
const validarOrdenItem = [
  body('ordenId')
    .isInt({ min: 1 })
    .withMessage('ordenId debe ser un número válido'),

  body('productoId')
    .isInt({ min: 1 })
    .withMessage('productoId es requerido y debe ser un número válido'),

  body('cantidad')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número mayor a 0'),

  body('precio')
    .isFloat({ min: 0.01 })
    .withMessage('El precio debe ser mayor a 0'),

  body('nombreProducto')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('El nombre del producto no puede exceder 100 caracteres'),

  body('talla')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('La talla no puede exceder 20 caracteres')
];

const validarID = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número válido')
];

const validarOrdenIdQuery = [
  query('ordenId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ordenId debe ser un número válido')
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
   ➕ CREAR ORDEN CON ITEMS (Protegido)
   ============================ */
router.post('/', auth, [
  body('items').isArray().withMessage('items debe ser un array'),
  body('items.*.productoId').isInt({ min: 1 }).withMessage('Cada item debe tener productoId válido'),
  body('items.*.cantidad').isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0'),
  body('items.*.precio').isFloat({ min: 0.01 }).withMessage('Precio debe ser mayor a 0'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { items, ...ordenData } = req.body;

    // Validar que la orden tenga al menos un item
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'La orden debe contener al menos un item'
      });
    }

    // Crear la orden
    const nuevaOrden = await Orden.create({
      ...ordenData,
      usuarioId: req.user.id // Asociar al usuario autenticado
    });

    // Crear los OrdenItems
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

    // Retornar la orden completa
    const ordenCompleta = await Orden.findByPk(nuevaOrden.id, {
      include: [{ model: OrdenItem, as: 'items' }]
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
   📋 OBTENER ITEMS DE ORDEN (Protegido)
   ============================ */
router.get('/', auth, validarOrdenIdQuery, handleValidationErrors, async (req, res) => {
  try {
    const { ordenId } = req.query;

    // Si viene un ordenId por query, filtrar
    if (ordenId) {
      // Verificar que la orden existe y pertenece al usuario
      const orden = await Orden.findByPk(ordenId);

      if (!orden) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      // Validar que el usuario sea dueño de la orden (o admin)
      if (orden.usuarioId !== req.user.id && req.user.rol !== 'admin') {
        return res.status(403).json({
          error: 'No tienes permiso para ver los items de esta orden'
        });
      }

      const items = await OrdenItem.findAll({
        where: { ordenId },
        include: [
          {
            model: Producto,
            as: 'producto',
            attributes: ['nombre', 'descripcion', 'precio']
          }
        ]
      });

      return res.json(items);
    }

    // Si no viene ordenId y es admin, retornar todos
    if (req.user.rol === 'admin') {
      const items = await OrdenItem.findAll({
        include: [
          {
            model: Producto,
            as: 'producto',
            attributes: ['nombre', 'precio']
          }
        ]
      });
      return res.json(items);
    }

    // Si es cliente sin ordenId específica, retornar error
    res.status(400).json({
      error: 'Debes proporcionar ordenId como parámetro de query'
    });

  } catch (error) {
    console.error('Error al obtener items:', error);
    res.status(500).json({ error: 'Error al obtener los items' });
  }
});

/* ============================
   🔍 OBTENER ITEM POR ID (Protegido)
   ============================ */
router.get('/:id', auth, validarID, handleValidationErrors, async (req, res) => {
  try {
    const item = await OrdenItem.findByPk(req.params.id, {
      include: [
        {
          model: Producto,
          as: 'producto',
          attributes: ['nombre', 'precio', 'descripcion']
        },
        {
          model: Orden,
          as: 'orden',
          attributes: ['id', 'usuarioId']
        }
      ]
    });

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    // Validar que el usuario sea dueño de la orden (o admin)
    if (item.orden.usuarioId !== req.user.id && req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para ver este item'
      });
    }

    res.json(item);

  } catch (error) {
    console.error('Error al obtener item:', error);
    res.status(500).json({ error: 'Error al obtener el item' });
  }
});

/* ============================
   ✏️ ACTUALIZAR ITEM (Protegido - Solo admin)
   ============================ */
router.put('/:id', auth, validarID, [
  body('cantidad').optional().isInt({ min: 1 }).withMessage('Cantidad debe ser mayor a 0'),
  body('precio').optional().isFloat({ min: 0.01 }).withMessage('Precio debe ser mayor a 0'),
  body('talla').optional().trim().isLength({ max: 20 }),
  handleValidationErrors
], async (req, res) => {
  try {
    // Solo admin puede actualizar items
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para actualizar items'
      });
    }

    const item = await OrdenItem.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const { cantidad, precio, talla } = req.body;

    const datosActualizados = {};
    if (cantidad !== undefined) datosActualizados.cantidad = parseInt(cantidad);
    if (precio !== undefined) datosActualizados.precio = parseFloat(precio);
    if (talla !== undefined) datosActualizados.talla = talla ? talla.trim() : null;

    await item.update(datosActualizados);

    res.json({
      message: 'Item actualizado exitosamente',
      item
    });

  } catch (error) {
    console.error('Error al actualizar item:', error);
    res.status(500).json({ error: 'Error al actualizar el item' });
  }
});

/* ============================
   🗑️ ELIMINAR ITEM (Protegido - Solo admin)
   ============================ */
router.delete('/:id', auth, validarID, handleValidationErrors, async (req, res) => {
  try {
    // Solo admin puede eliminar items
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para eliminar items'
      });
    }

    const item = await OrdenItem.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    await item.destroy();

    res.json({ message: 'Item eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar item:', error);
    res.status(500).json({ error: 'Error al eliminar el item' });
  }
});

module.exports = router;
