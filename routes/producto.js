const express = require('express');
const router = express.Router();
const { Producto, Categoria } = require('../models');
const multer = require('multer');
const path = require('path');
const upload = require('../middlewares/upload');


router.post('/', upload.array('imagen', 10), async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      precio,
      categoriaId,
      color,
      talla,
      cantidad,
      composicion,
      info,
      cuidados,
      seleccionado  
    } = req.body;

    const imagenes = req.files ? req.files.map(file => file.path) : [];

    const nuevoProducto = await Producto.create({
      nombre,
      descripcion,
      precio,
      imagen: imagenes, 
      categoriaId,
      color,
      talla,
      cantidad,
      composicion,
      info,
      cuidados,
      seleccionado 
    });

    res.status(201).json(nuevoProducto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});


router.get('/', async (req, res) => {
  try {
    const productos = await Producto.findAll({
      include: { model: Categoria, as: 'categoria' }
    });

    res.json(productos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


router.get('/seleccionados', async (req, res) => {
  try {
    const productos = await Producto.findAll({
      where: { seleccionado: true },
      include: { model: Categoria, as: 'categoria' }
    });

    res.json(productos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});



// Obtener un producto por ID
router.get('/:id', async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id, {
      include: { model: Categoria, as: 'categoria' }
    });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Editar Producto
router.put('/:id', upload.array('imagen', 10), async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const {
      nombre,
      descripcion,
      precio,
      categoriaId,
      color,
      talla,
      cantidad,
      composicion,
      info,
      cuidados,
      seleccionado,
    } = req.body;

    const nuevasImagenes = req.files && req.files.length > 0
      ? req.files.map(file => file.path)
      : producto.imagen;

    await producto.update({
      nombre,
      descripcion,
      precio,
      imagen: nuevasImagenes,
      categoriaId,
      color,
      talla,
      cantidad,
      composicion,
      info,
      cuidados,
      seleccionado,
    });

    res.json(producto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});




//Eliminar Producto 
router.delete('/:id', async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await producto.destroy();
    res.json({ mensaje: 'Producto eliminado correctamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});



module.exports = router;
