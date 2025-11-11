const express = require('express');
const router = express.Router();
const { Reclamo } = require('../models');

// 👉 Crear un nuevo reclamo
router.post('/', async (req, res) => {
  try {
    const { usuarioId, ordenId, mensaje } = req.body;

    if (!usuarioId || !ordenId || !mensaje) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const nuevoReclamo = await Reclamo.create({ usuarioId, ordenId, mensaje });
    res.status(201).json({ mensaje: 'Reclamo enviado correctamente', reclamo: nuevoReclamo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar reclamo' });
  }
});

// 👉 Obtener todos los reclamos (puedes filtrar por usuarioId o admin)
router.get('/', async (req, res) => {
  try {
    const reclamos = await Reclamo.findAll();
    res.json(reclamos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener reclamos' });
  }
});

// 👉 Obtener un reclamo por ID
router.get('/:id', async (req, res) => {
  try {
    const reclamo = await Reclamo.findByPk(req.params.id);
    if (!reclamo) return res.status(404).json({ error: 'Reclamo no encontrado' });

    res.json(reclamo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el reclamo' });
  }
});

// 👉 Editar un reclamo
router.put('/:id', async (req, res) => {
  try {
    const { mensaje, estado } = req.body;

    const reclamo = await Reclamo.findByPk(req.params.id);
    if (!reclamo) return res.status(404).json({ error: 'Reclamo no encontrado' });

    if (mensaje) reclamo.mensaje = mensaje;
    if (estado) reclamo.estado = estado;

    await reclamo.save();
    res.json({ mensaje: 'Reclamo actualizado', reclamo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el reclamo' });
  }
});

// 👉 Eliminar un reclamo
router.delete('/:id', async (req, res) => {
  try {
    const reclamo = await Reclamo.findByPk(req.params.id);
    if (!reclamo) return res.status(404).json({ error: 'Reclamo no encontrado' });

    await reclamo.destroy();
    res.json({ mensaje: 'Reclamo eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar el reclamo' });
  }
});

module.exports = router;
