'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrdenItem extends Model {
    static associate(models) {
      OrdenItem.belongsTo(models.Orden, {
        foreignKey: 'ordenId',
        as: 'orden',
        onDelete: 'CASCADE'
      });
        OrdenItem.belongsTo(models.Producto, {
        foreignKey: 'productoId',
        as: 'producto',
        onDelete: 'SET NULL'
      });
    }
  }

  OrdenItem.init({
    ordenId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    productoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    precio: {
      type: DataTypes.FLOAT,
      allowNull: false,
    }
  }, {
    sequelize,
    modelName: 'OrdenItem',
  });

  return OrdenItem;
};
