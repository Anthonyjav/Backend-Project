const express = require('express');
const router = express.Router();
const { OrdenItem } = require('../models');

// Crear item
router.post('/', async (req, res) => {
  try {
    const nuevoItem = await OrdenItem.create(req.body);
    res.status(201).json(nuevoItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los items
// Obtener todos los items o filtrar por ordenId
router.get('/', async (req, res) => {
  try {
    const { ordenId } = req.query;

    // Si viene un ordenId por query, filtrar
    if (ordenId) {
      const items = await OrdenItem.findAll({
        where: { ordenId },
        include: [
          {
            model: require('../models').Producto,
            as: 'producto',
            attributes: ['nombre']
          }
        ]
      });

      // Adjuntar el nombre del producto directamente
      const itemsConNombre = items.map((item) => ({
        ...item.toJSON(),
        nombreProducto: item.producto?.nombre || 'Desconocido'
      }));

      return res.json(itemsConNombre);
    }

    // Si no se proporciona ordenId, retornar todos los items
    const items = await OrdenItem.findAll();
    res.json(items);
  } catch (error) {
    console.error('Error al obtener items:', error);
    res.status(500).json({ error: error.message });
  }
});


// Obtener por ID
router.get('/:id', async (req, res) => {
  try {
    const item = await OrdenItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar
router.put('/:id', async (req, res) => {
  try {
    const item = await OrdenItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    await item.update(req.body, {
      fields: Object.keys(req.body)
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  try {
    const item = await OrdenItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: 'No encontrado' });

    await item.destroy();
    res.json({ mensaje: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
