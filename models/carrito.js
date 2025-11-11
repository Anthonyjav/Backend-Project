'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Carrito extends Model {
    static associate(models) {
      Carrito.belongsTo(models.Usuario, {
        foreignKey: 'usuarioId',
        as: 'usuario',
        onDelete: 'CASCADE'
      });

      Carrito.hasMany(models.CarritoItem, {
        foreignKey: 'carritoId',
        as: 'items',
        onDelete: 'CASCADE'
      });
    }
  }

  Carrito.init({
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Carrito',
  });

  return Carrito;
};
