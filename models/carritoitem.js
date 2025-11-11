'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CarritoItem extends Model {
    static associate(models) {
      CarritoItem.belongsTo(models.Carrito, {
        foreignKey: 'carritoId',
        as: 'carrito',
        onDelete: 'CASCADE'
      });

      CarritoItem.belongsTo(models.Producto, {
        foreignKey: 'productoId',
        as: 'producto',
        onDelete: 'CASCADE'
      });
    }
  }

  CarritoItem.init({
    carritoId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    productoId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cantidad: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    talla: DataTypes.STRING,
    color: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'CarritoItem',
  });

  return CarritoItem;
};
