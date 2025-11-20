const express = require('express');
const router = express.Router();
const { Orden, OrdenItem, Usuario,Producto  } = require('../models');

router.post('/', async (req, res) => {
  try {
    console.log("BODY recibido:", req.body); // 👈 LOG IMPORTANTE

    const orden = await Orden.create(req.body, {
      include: [{ model: OrdenItem, as: 'items' }]
    });

    res.json(orden);

  } catch (error) {
    console.error("🔥 ERROR AL CREAR ORDEN:", error); // 👈 MOSTRAR ERROR REAL
    res.status(500).json({ error: error.message }); // 👈 DEVOLVER ERROR REAL
  }
});


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
              attributes: ['id', 'nombre']
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
// Crear una nueva orden
router.post('/', async (req, res) => {
  try {
    const {
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
      orderId,
      currency,
      note,
      items // <-- VIENE DEL CARRITO
    } = req.body;

    // 1. Crear la orden
    const nuevaOrden = await Orden.create({
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
      orderId,
      currency,
      note
    });

    // 2. Crear items de la orden
    if (items && items.length > 0) {
      for (const item of items) {
        await OrdenItem.create({
          ordenId: nuevaOrden.id,
          productoId: item.id,
          nombreProducto: item.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precio,
          talla: item.talla
        });
      }
    }

    res.json({ message: 'Orden creada correctamente', orden: nuevaOrden });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la orden', details: error });
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