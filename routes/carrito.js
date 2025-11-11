const express = require('express');
const router = express.Router();
const { Carrito, CarritoItem, Producto, Usuario } = require('../models');

// Obtener carrito completo por usuarioId
router.get('/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;

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
router.post('/add', async (req, res) => {
  try {
    const { usuarioId, productoId, cantidad, talla, color } = req.body;

    let carrito = await Carrito.findOne({ where: { usuarioId } });
    if (!carrito) carrito = await Carrito.create({ usuarioId });

    let item = await CarritoItem.findOne({
      where: {
        carritoId: carrito.id,
        productoId,
        talla,
        color
      }
    });

    if (item) {
      item.cantidad += cantidad;
      await item.save();
    } else {
      item = await CarritoItem.create({
        carritoId: carrito.id,
        productoId,
        cantidad,
        talla,
        color
      });
    }

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar producto al carrito' });
  }
});

// Actualizar un ítem del carrito
router.put('/update/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { cantidad, talla, color } = req.body;

    const item = await CarritoItem.findByPk(itemId);
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    if (cantidad !== undefined) item.cantidad = cantidad;
    if (talla !== undefined) item.talla = talla;
    if (color !== undefined) item.color = color;

    await item.save();
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar item del carrito' });
  }
});

// Eliminar un ítem del carrito
router.delete('/remove/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const deleted = await CarritoItem.destroy({ where: { id: itemId } });
    if (!deleted) return res.status(404).json({ error: 'Item no encontrado' });

    res.json({ mensaje: 'Item eliminado del carrito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
});

// Vaciar todo el carrito de un usuario
router.delete('/clear/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;

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
