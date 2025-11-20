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
      defaultValue: 'pendiente' // ahora por defecto pendiente hasta confirmar el pago
    },
    subtotal: DataTypes.FLOAT,
    envio: DataTypes.FLOAT,
    total: DataTypes.FLOAT,
    cuponCodigo: DataTypes.STRING,

    // Campos específicos para Izipay
    orderIdIzipay: DataTypes.STRING,      // ID que devuelve Izipay
    transactionId: DataTypes.STRING,      // ID de la transacción en Izipay
    paymentStatus: DataTypes.STRING,      // Estado del pago (APPROVED, DECLINED, PENDING)
    paymentResponse: DataTypes.JSON,      // Guardar el payload completo de Izipay
    paymentDate: DataTypes.DATE           // Fecha en que se confirma el pago
  }, {
    sequelize,
    modelName: 'Orden',
  });

  return Orden;
};
