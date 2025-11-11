'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Orden extends Model {
    static associate(models) {
      Orden.belongsTo(models.Usuario, {
        foreignKey: 'usuarioId',
        as: 'usuario',
        onDelete: 'SET NULL'
      });

      Orden.hasMany(models.OrdenItem, {
        foreignKey: 'ordenId',
        as: 'items',
        onDelete: 'CASCADE'
      });
    }
  }

  Orden.init({
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nombre: DataTypes.STRING,
    apellido: DataTypes.STRING,
    email: DataTypes.STRING,
    telefono: DataTypes.STRING,
    pais: DataTypes.STRING,
    departamento: DataTypes.STRING,
    provincia: DataTypes.STRING,
    distrito: DataTypes.STRING,
    direccion: DataTypes.STRING,
    referencia: DataTypes.STRING,
    metodoEnvio: DataTypes.STRING,
    estado: {
      type: DataTypes.STRING,
      defaultValue: 'completado'
    },
    subtotal: DataTypes.FLOAT,
    envio: DataTypes.FLOAT,
    total: DataTypes.FLOAT,
    cuponCodigo: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Orden',
  });

  return Orden;
};
