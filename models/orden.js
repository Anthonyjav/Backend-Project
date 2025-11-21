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
    note: DataTypes.TEXT,           
    currency: DataTypes.STRING,      
    estado: {
      type: DataTypes.STRING,
      defaultValue: 'pendiente'
    },
    subtotal: DataTypes.DECIMAL(10,2),
    envio: DataTypes.DECIMAL(10,2),
    total: DataTypes.DECIMAL(10,2),
    cuponCodigo: DataTypes.STRING,

    orderIdIzipay: DataTypes.STRING,
    transactionId: DataTypes.STRING,
    paymentStatus: DataTypes.STRING,
    paymentResponse: DataTypes.TEXT,
    paymentDate: DataTypes.DATE,
    orderidizipay: DataTypes.STRING,
    transactionid: DataTypes.STRING,
    paymentstatus: DataTypes.STRING,
    paymentresponse: DataTypes.TEXT,
    paymentdate: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Orden',
    tableName: 'Ordens',    
    freezeTableName: true,
    timestamps: true

  });

  return Orden;
};
