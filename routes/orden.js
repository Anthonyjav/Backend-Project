const express = require('express');
const router = express.Router();
const { Orden, OrdenItem, Usuario,Producto  } = require('../models');

// Obtener todas las órdenes
router.get('/', async (req, res) => {
  try {
    const ordenes = await Orden.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json(ordenes);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
});

// Obtener una orden específica
router.get('/:id', async (req, res) => {
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
              attributes: ['id', 'nombre'] // aquí está el cambio clave
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

    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    res.json(orden);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la orden' });
  }
});


// Crear una nueva orden
router.post('/', async (req, res) => {
  try {
    const {
      usuarioId, nombre, apellido, email, telefono,
      pais, departamento, provincia, distrito,
      direccion, referencia, metodoEnvio,
      subtotal, envio, total, cuponCodigo,
      items
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La orden debe contener al menos un producto' });
    }

    // Crear orden principal
    const orden = await Orden.create({
      usuarioId,
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
      cuponCodigo,
      estado: 'completado'
    });

    // Crear los items relacionados
    const itemsConOrdenId = items.map(item => ({
    ordenId: orden.id,
    productoId: item.productoId,
    cantidad: item.cantidad,
    precio: item.precio // Asegúrate que este campo existe y representa el precio unitario o total
    }));


    await OrdenItem.bulkCreate(itemsConOrdenId);

    // Traer la orden completa con relaciones
    const ordenConTodo = await Orden.findByPk(orden.id, {
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
      ]
    });

    res.status(201).json({
      mensaje: 'Orden creada correctamente',
      orden: ordenConTodo
    });

  } catch (error) {
    console.error(' Error al crear orden:', error);
    res.status(500).json({ error: 'Error al crear orden' });
  }
});


  

// Eliminar una orden
router.delete('/:id', async (req, res) => {
  try {
    const orden = await Orden.findByPk(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    await OrdenItem.destroy({ where: { ordenId: orden.id } });
    await orden.destroy();

    res.json({ mensaje: 'Orden eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la orden' });
  }
});

// Actualizar solo el estado de una orden
router.put('/:id', async (req, res) => {
  try {
    const { subtotal, envio, total, estado } = req.body;

    const orden = await Orden.findByPk(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    orden.subtotal = subtotal !== undefined ? subtotal : orden.subtotal;
    orden.envio = envio !== undefined ? envio : orden.envio;
    orden.total = total !== undefined ? total : orden.total;
    orden.estado = estado !== undefined ? estado : orden.estado;

    await orden.save();

    res.json({ mensaje: 'Orden actualizada', orden });
  } catch (error) {
    console.error(' Error al actualizar orden:', error);
    res.status(500).json({ error: 'Error al actualizar la orden' });
  }
});


module.exports = router;