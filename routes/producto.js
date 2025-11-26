const express = require('express');
const router = express.Router();
const { Producto, Categoria } = require('../models');
const { body, param, validationResult } = require('express-validator');
const upload = require('../middlewares/upload');
const auth = require('../middlewares/auth');

/* ============================
   ✅ VALIDADORES
   ============================ */
const validarProducto = [
  body('nombre')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres')
    .notEmpty()
    .withMessage('El nombre es requerido'),

  body('descripcion')
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),

  body('precio')
    .isFloat({ min: 0.01 })
    .withMessage('El precio debe ser mayor a 0'),

  body('categoriaId')
    .isInt({ min: 1 })
    .withMessage('categoriaId debe ser un número válido'),

  body('cantidad')
    .optional()
    .isInt({ min: 0 })
    .withMessage('La cantidad debe ser un número positivo'),

  body('color')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('El color no puede exceder 50 caracteres'),

  body('talla')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('La talla no puede exceder 20 caracteres'),

  body('composicion')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La composición no puede exceder 500 caracteres'),

  body('info')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La info no puede exceder 500 caracteres'),

  body('cuidados')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Los cuidados no pueden exceder 500 caracteres'),

  body('seleccionado')
    .optional()
    .isBoolean()
    .withMessage('seleccionado debe ser true o false')
];

const validarID = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número válido')
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
   ✅ CREAR PRODUCTO (Protegido - Admin)
   ============================ */
router.post('/', auth, upload.array('imagen', 10), validarProducto, handleValidationErrors, async (req, res) => {
  try {
    // Validar que solo admin pueda crear productos
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para crear productos'
      });
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
      seleccionado
    } = req.body;

    // Validar que la categoría existe
    const categoria = await Categoria.findByPk(categoriaId);
    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const imagenes = req.files ? req.files.map(file => file.path) : [];

    const nuevoProducto = await Producto.create({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      precio: parseFloat(precio),
      imagen: imagenes.length > 0 ? imagenes : null,
      categoriaId,
      color: color ? color.trim() : null,
      talla: talla ? talla.trim() : null,
      cantidad: cantidad ? parseInt(cantidad) : 0,
      composicion: composicion ? composicion.trim() : null,
      info: info ? info.trim() : null,
      cuidados: cuidados ? cuidados.trim() : null,
      seleccionado: seleccionado === 'true' || seleccionado === true
    });

    res.status(201).json({
      message: 'Producto creado exitosamente',
      producto: nuevoProducto
    });

  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

/* ============================
   📦 OBTENER TODOS LOS PRODUCTOS (Público)
   ============================ */
router.get('/', async (req, res) => {
  try {
    const productos = await Producto.findAll({
      include: { model: Categoria, as: 'categoria' },
      order: [['id', 'DESC']]
    });

    res.json(productos);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

/* ============================
   ⭐ OBTENER PRODUCTOS SELECCIONADOS (Público)
   ============================ */
router.get('/seleccionados', async (req, res) => {
  try {
    const productos = await Producto.findAll({
      where: { seleccionado: true },
      include: { model: Categoria, as: 'categoria' },
      order: [['id', 'DESC']]
    });

    res.json(productos);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos seleccionados' });
  }
});

/* ============================
   🔍 OBTENER PRODUCTO POR ID (Público)
   ============================ */
router.get('/:id', validarID, handleValidationErrors, async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id, {
      include: { model: Categoria, as: 'categoria' }
    });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

/* ============================
   ✏️ EDITAR PRODUCTO (Protegido - Admin)
   ============================ */
router.put('/:id', auth, validarID, upload.array('imagen', 10), validarProducto, handleValidationErrors, async (req, res) => {
  try {
    // Validar que solo admin pueda editar productos
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para editar productos'
      });
    }

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
      seleccionado
    } = req.body;

    // Validar que la categoría existe si se actualiza
    if (categoriaId) {
      const categoria = await Categoria.findByPk(categoriaId);
      if (!categoria) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
    }

    // Mantener imágenes antiguas si no se envían nuevas
    const nuevasImagenes = req.files && req.files.length > 0
      ? req.files.map(file => file.path)
      : producto.imagen;

    await producto.update({
      nombre: nombre ? nombre.trim() : producto.nombre,
      descripcion: descripcion ? descripcion.trim() : producto.descripcion,
      precio: precio ? parseFloat(precio) : producto.precio,
      imagen: nuevasImagenes,
      categoriaId: categoriaId || producto.categoriaId,
      color: color ? color.trim() : producto.color,
      talla: talla ? talla.trim() : producto.talla,
      cantidad: cantidad !== undefined ? parseInt(cantidad) : producto.cantidad,
      composicion: composicion ? composicion.trim() : producto.composicion,
      info: info ? info.trim() : producto.info,
      cuidados: cuidados ? cuidados.trim() : producto.cuidados,
      seleccionado: seleccionado !== undefined ? (seleccionado === 'true' || seleccionado === true) : producto.seleccionado
    });

    res.json({
      message: 'Producto actualizado exitosamente',
      producto
    });

  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

/* ============================
   🗑️ ELIMINAR PRODUCTO (Protegido - Admin)
   ============================ */
router.delete('/:id', auth, validarID, handleValidationErrors, async (req, res) => {
  try {
    // Validar que solo admin pueda eliminar productos
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para eliminar productos'
      });
    }

    const producto = await Producto.findByPk(req.params.id);

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await producto.destroy();

    res.json({ message: 'Producto eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

module.exports = router;
