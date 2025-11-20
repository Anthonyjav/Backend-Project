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
    orderId: {
      type: DataTypes.STRING,
      allowNull: false
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
    note: DataTypes.TEXT,            // Campo opcional para comentarios
    currency: DataTypes.STRING,      // Moneda del pago
    estado: {
      type: DataTypes.STRING,
      defaultValue: 'pendiente'
    },
    subtotal: DataTypes.DECIMAL(10,2),
    envio: DataTypes.DECIMAL(10,2),
    total: DataTypes.DECIMAL(10,2),
    cuponCodigo: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Orden',
    tableName: 'ordens',    
    freezeTableName: true   
  });

  return Orden;
};
