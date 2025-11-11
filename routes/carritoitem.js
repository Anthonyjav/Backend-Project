const express = require('express');
const router = express.Router();
const { CarritoItem, Carrito, Producto } = require('../models');

// Obtener todos los items del carrito de un usuario
router.get('/:usuarioId', async (req, res) => {
  try {
    const carrito = await Carrito.findOne({ where: { usuarioId: req.params.usuarioId } });

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

// Agregar un item al carrito
router.post('/', async (req, res) => {
  try {
    const { usuarioId, productoId, cantidad, talla, color } = req.body;

    let carrito = await Carrito.findOne({ where: { usuarioId } });
    if (!carrito) {
      carrito = await Carrito.create({ usuarioId });
    }

    // Verificamos si ya existe el mismo producto con misma talla y color
    let itemExistente = await CarritoItem.findOne({
      where: {
        carritoId: carrito.id,
        productoId,
        talla,
        color
      }
    });

    if (itemExistente) {
      itemExistente.cantidad += cantidad;
      await itemExistente.save();
      return res.status(200).json(itemExistente);
    }

    const nuevoItem = await CarritoItem.create({
      carritoId: carrito.id,
      productoId,
      cantidad,
      talla,
      color
    });

    res.status(201).json(nuevoItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar item al carrito' });
  }
});

// Actualizar un item del carrito (por id del item)
router.put('/:id', async (req, res) => {
  try {
    const item = await CarritoItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    const { cantidad, talla, color } = req.body;

    item.cantidad = cantidad !== undefined ? cantidad : item.cantidad;
    item.talla = talla !== undefined ? talla : item.talla;
    item.color = color !== undefined ? color : item.color;

    await item.save();

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar item del carrito' });
  }
});

// Eliminar un item específico del carrito
router.delete('/:id', async (req, res) => {
  try {
    const item = await CarritoItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    await item.destroy();
    res.json({ mensaje: 'Item eliminado del carrito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar item del carrito' });
  }
});

module.exports = router;
