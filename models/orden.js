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
    pais: {
      type: DataTypes.STRING,
      defaultValue: 'Perú'
    },
    departamento: DataTypes.STRING,
    provincia: DataTypes.STRING,
    distrito: DataTypes.STRING,
    direccion: DataTypes.STRING,
    referencia: DataTypes.STRING,
    metodoEnvio: DataTypes.STRING,
    estado: {
      type: DataTypes.STRING,
      defaultValue: 'pendiente'
    },
    subtotal: DataTypes.FLOAT,
    envio: DataTypes.FLOAT,
    total: DataTypes.FLOAT,
    cuponCodigo: DataTypes.STRING,

    // Campos específicos para Izipay con mapeo de nombre de columna
    orderIdIzipay: {
      type: DataTypes.STRING,
      field: 'orderidizipay'   // nombre real en la DB
    },
    transactionId: {
      type: DataTypes.STRING,
      field: 'transactionid'
    },
    paymentStatus: {
      type: DataTypes.STRING,
      field: 'paymentstatus'
    },
    paymentResponse: {
      type: DataTypes.JSON,
      field: 'paymentresponse'
    },
    paymentDate: {
      type: DataTypes.DATE,
      field: 'paymentdate'
    }
  }, {
    sequelize,
    modelName: 'Orden',
  });

  return Orden;
};
