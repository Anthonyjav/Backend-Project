const express = require('express');
const router = express.Router();
const { Orden, OrdenItem, Carrito, CarritoItem, Producto } = require('../models');
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

// Obtener todos los items del carrito de un usuario
// Solo el usuario propietario o admin puede consultar
router.get('/:usuarioId', auth, [
  param('usuarioId').isInt({ min: 1 }).withMessage('usuarioId inválido')
], handleValidationErrors, async (req, res) => {
  try {
    const usuarioId = parseInt(req.params.usuarioId, 10);

    // Permisos: propietario o admin
    if (req.user.id !== usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para ver este carrito' });
    }

    const carrito = await Carrito.findOne({ where: { usuarioId } });

    if (!carrito) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }

    const items = await CarritoItem.findAll({
      where: { carritoId: carrito.id },
      include: {
        model: Producto,
        as: 'producto'
      }
    });

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los items del carrito' });
  }
});

router.post('/', auth, [
  body('productoId').isInt({ min: 1 }).withMessage('productoId inválido'),
  body('cantidad').isInt({ min: 1 }).withMessage('cantidad debe ser >= 1'),
  body('talla').optional().trim().isLength({ max: 20 }),
  body('color').optional().trim().isLength({ max: 50 }),
  // opcionalmente permitir admin crear para otro usuario
  body('usuarioId').optional().isInt({ min: 1 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { productoId, cantidad, talla, color } = req.body;
    // Si se pasó usuarioId solo admin puede usarlo
    const targetUsuarioId = req.body.usuarioId ? parseInt(req.body.usuarioId, 10) : req.user.id;

    if (req.body.usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para crear items en otro carrito' });
    }

    // Verificar que el producto existe
    const producto = await Producto.findByPk(productoId);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    let carrito = await Carrito.findOne({ where: { usuarioId: targetUsuarioId } });
    if (!carrito) {
      carrito = await Carrito.create({ usuarioId: targetUsuarioId });
    }

    // Verificamos si ya existe el mismo producto con misma talla y color
    let itemExistente = await CarritoItem.findOne({
      where: {
        carritoId: carrito.id,
        productoId,
        talla: talla || null,
        color: color || null
      }
    });

    if (itemExistente) {
      itemExistente.cantidad = itemExistente.cantidad + parseInt(cantidad, 10);
      await itemExistente.save();
      return res.status(200).json(itemExistente);
    }

    const nuevoItem = await CarritoItem.create({
      carritoId: carrito.id,
      productoId,
      cantidad: parseInt(cantidad, 10),
      talla: talla || null,
      color: color || null
    });

    res.status(201).json(nuevoItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar item al carrito' });
  }
});

// Actualizar un item del carrito (por id del item)
router.put('/:id', auth, [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  body('cantidad').optional().isInt({ min: 1 }).withMessage('cantidad debe ser >= 1'),
  body('talla').optional().trim().isLength({ max: 20 }),
  body('color').optional().trim().isLength({ max: 50 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const item = await CarritoItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    // Verificar que el usuario es propietario del carrito o admin
    const carrito = await Carrito.findByPk(item.carritoId);
    if (!carrito) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (req.user.id !== carrito.usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para modificar este item' });
    }

    const { cantidad, talla, color } = req.body;

    if (cantidad !== undefined) item.cantidad = parseInt(cantidad, 10);
    if (talla !== undefined) item.talla = talla || null;
    if (color !== undefined) item.color = color || null;

    await item.save();
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar item del carrito' });
  }
});

// Eliminar un item específico del carrito
router.delete('/:id', auth, [
  param('id').isInt({ min: 1 }).withMessage('id inválido'),
  handleValidationErrors
], async (req, res) => {
  try {
    const item = await CarritoItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    const carrito = await Carrito.findByPk(item.carritoId);
    if (!carrito) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (req.user.id !== carrito.usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este item' });
    }

    await item.destroy();
    res.json({ mensaje: 'Item eliminado del carrito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar item del carrito' });
  }
});

module.exports = router;
