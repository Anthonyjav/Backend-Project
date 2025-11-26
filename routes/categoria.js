const express = require('express');
const router = express.Router();
const { Categoria, Producto } = require('../models');
const { body, param, validationResult } = require('express-validator');
const auth = require('../middlewares/auth');

/* ============================
   ✅ VALIDADORES
   ============================ */
const validarCategoria = [
  body('nombre')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('El nombre debe tener entre 3 y 50 caracteres')
    .notEmpty()
    .withMessage('El nombre es requerido'),

  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),

  body('imagen')
    .optional()
    .trim()
    .isURL()
    .withMessage('La imagen debe ser una URL válida')
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
   📋 LISTAR CATEGORÍAS (Público)
   ============================ */
router.get('/', async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      order: [['nombre', 'ASC']]
    });

    res.json(categorias);

  } catch (err) {
    console.error('Error al obtener categorías:', err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

/* ============================
   🔍 OBTENER CATEGORÍA POR ID (Público)
   ============================ */
router.get('/:id', validarID, handleValidationErrors, async (req, res) => {
  try {
    const categoria = await Categoria.findByPk(req.params.id, {
      include: {
        model: Producto,
        as: 'productos',
        attributes: ['id', 'nombre', 'precio']
      }
    });

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json(categoria);

  } catch (error) {
    console.error('Error al obtener categoría:', error);
    res.status(500).json({ error: 'Error al obtener la categoría' });
  }
});

/* ============================
   ➕ CREAR CATEGORÍA (Protegido - Solo Admin)
   ============================ */
router.post('/', auth, validarCategoria, handleValidationErrors, async (req, res) => {
  try {
    // Validar que es admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para crear categorías'
      });
    }

    const { nombre, descripcion, imagen } = req.body;

    // Verificar que no exista categoría con el mismo nombre
    const categoriaExistente = await Categoria.findOne({
      where: { nombre: nombre.trim() }
    });

    if (categoriaExistente) {
      return res.status(409).json({
        error: 'Ya existe una categoría con este nombre'
      });
    }

    const nuevaCategoria = await Categoria.create({
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      imagen: imagen ? imagen.trim() : null
    });

    res.status(201).json({
      message: 'Categoría creada exitosamente',
      categoria: nuevaCategoria
    });

  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

/* ============================
   ✏️ EDITAR CATEGORÍA (Protegido - Solo Admin)
   ============================ */
router.put('/:id', auth, validarID, validarCategoria, handleValidationErrors, async (req, res) => {
  try {
    // Validar que es admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para editar categorías'
      });
    }

    const categoria = await Categoria.findByPk(req.params.id);

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const { nombre, descripcion, imagen } = req.body;

    // Verificar que el nuevo nombre no exista (excepto la categoría actual)
    if (nombre && nombre.trim() !== categoria.nombre) {
      const categoriaExistente = await Categoria.findOne({
        where: { nombre: nombre.trim() }
      });

      if (categoriaExistente) {
        return res.status(409).json({
          error: 'Ya existe una categoría con este nombre'
        });
      }
    }

    await categoria.update({
      nombre: nombre ? nombre.trim() : categoria.nombre,
      descripcion: descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : categoria.descripcion,
      imagen: imagen !== undefined ? (imagen ? imagen.trim() : null) : categoria.imagen
    });

    res.json({
      message: 'Categoría actualizada exitosamente',
      categoria
    });

  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
});

/* ============================
   🗑️ ELIMINAR CATEGORÍA (Protegido - Solo Admin)
   ============================ */
router.delete('/:id', auth, validarID, handleValidationErrors, async (req, res) => {
  try {
    // Validar que es admin
    if (req.user.rol !== 'admin') {
      return res.status(403).json({
        error: 'No tienes permiso para eliminar categorías'
      });
    }

    const categoria = await Categoria.findByPk(req.params.id);

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    // Validar que no tenga productos asociados
    const productosAsociados = await Producto.findAll({
      where: { categoriaId: req.params.id }
    });

    if (productosAsociados.length > 0) {
      return res.status(409).json({
        error: `No se puede eliminar la categoría porque tiene ${productosAsociados.length} producto(s) asociado(s)`,
        productosAsociados: productosAsociados.map(p => ({ id: p.id, nombre: p.nombre }))
      });
    }

    await categoria.destroy();

    res.json({ message: 'Categoría eliminada correctamente' });

  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
});

module.exports = router;
