const express = require('express');
const router = express.Router();
const { Carrito, CarritoItem, Producto, Usuario } = require('../models');
const { body, param, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');

// Manejo de errores de validación
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

// Obtener carrito completo por usuarioId
// Sólo el propietario o admin puede acceder
router.get('/:usuarioId', auth, [
  param('usuarioId').isInt({ min: 1 }).withMessage('usuarioId inválido')
], handleValidationErrors, async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.usuarioId, 10);

    if (req.user.id !== usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para ver este carrito' });
    }

    let carrito = await Carrito.findOne({
      where: { usuarioId },
      include: [
        {
          model: CarritoItem,
          as: 'items',
          include: {
            model: Producto,
            as: 'producto'
          }
        },
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'apellido', 'email']
        }
      ]
    });

    if (!carrito) {
      carrito = await Carrito.create({ usuarioId });
      carrito.items = [];
      carrito.usuario = await Usuario.findByPk(usuarioId, {
        attributes: ['id', 'nombre', 'apellido', 'email']
      });
    }

    res.json(carrito);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el carrito' });
  }
});


// Agregar producto al carrito
router.post('/add', auth, [
  body('productoId').isInt({ min: 1 }).withMessage('productoId inválido'),
  body('cantidad').isInt({ min: 1 }).withMessage('cantidad debe ser >= 1'),
  body('talla').optional().trim().isLength({ max: 20 }),
  body('color').optional().trim().isLength({ max: 50 }),
  body('usuarioId').optional().isInt({ min: 1 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { productoId, cantidad, talla, color } = req.body;
    const targetUsuarioId = req.body.usuarioId ? parseInt(req.body.usuarioId, 10) : req.user.id;

    if (req.body.usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para agregar items en otro carrito' });
    }

    // Verificar producto
    const producto = await Producto.findByPk(productoId);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    let carrito = await Carrito.findOne({ where: { usuarioId: targetUsuarioId } });
    if (!carrito) carrito = await Carrito.create({ usuarioId: targetUsuarioId });

    let item = await CarritoItem.findOne({
      where: {
        carritoId: carrito.id,
        productoId,
        talla: talla || null,
        color: color || null
      }
    });

    if (item) {
      item.cantidad = item.cantidad + parseInt(cantidad, 10);
      await item.save();
    } else {
      item = await CarritoItem.create({
        carritoId: carrito.id,
        productoId,
        cantidad: parseInt(cantidad, 10),
        talla: talla || null,
        color: color || null
      });
    }

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar producto al carrito' });
  }
});

// Actualizar un ítem del carrito
router.put('/update/:itemId', auth, [
  param('itemId').isInt({ min: 1 }).withMessage('itemId inválido'),
  body('cantidad').optional().isInt({ min: 1 }).withMessage('cantidad debe ser >= 1'),
  body('talla').optional().trim().isLength({ max: 20 }),
  body('color').optional().trim().isLength({ max: 50 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { itemId } = req.params;
    const { cantidad, talla, color } = req.body;

    const item = await CarritoItem.findByPk(itemId);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    const carrito = await Carrito.findByPk(item.carritoId);
    if (!carrito) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (req.user.id !== carrito.usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este item' });
    }

    if (cantidad !== undefined) item.cantidad = parseInt(cantidad, 10);
    if (talla !== undefined) item.talla = talla || null;
    if (color !== undefined) item.color = color || null;

    await item.save();
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar item del carrito' });
  }
});

// Eliminar un ítem del carrito
router.delete('/remove/:itemId', auth, [
  param('itemId').isInt({ min: 1 }).withMessage('itemId inválido'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await CarritoItem.findByPk(itemId);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    const carrito = await Carrito.findByPk(item.carritoId);
    if (!carrito) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (req.user.id !== carrito.usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este item' });
    }

    await CarritoItem.destroy({ where: { id: itemId } });
    res.json({ mensaje: 'Item eliminado del carrito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
});

// Vaciar todo el carrito de un usuario
router.delete('/clear/:usuarioId', auth, [
  param('usuarioId').isInt({ min: 1 }).withMessage('usuarioId inválido'),
  handleValidationErrors
], async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.usuarioId, 10);

    if (req.user.id !== usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para vaciar este carrito' });
    }

    const carrito = await Carrito.findOne({ where: { usuarioId } });
    if (!carrito) return res.status(404).json({ error: 'Carrito no encontrado' });

    await CarritoItem.destroy({ where: { carritoId: carrito.id } });

    res.json({ mensaje: 'Carrito vaciado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al vaciar el carrito' });
  }
});

module.exports = router;
