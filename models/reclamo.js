// models/reclamo.js
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Reclamo extends Model {
    static associate(models) {
      Reclamo.belongsTo(models.Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
      Reclamo.belongsTo(models.Orden, { foreignKey: 'ordenId', as: 'orden' });
    }
  }
  Reclamo.init({
    usuarioId: { type: DataTypes.INTEGER, allowNull: false },
    ordenId: { type: DataTypes.INTEGER, allowNull: false },
    mensaje: { type: DataTypes.TEXT, allowNull: false },
    estado: { type: DataTypes.STRING, defaultValue: 'completado' } 
  }, {
    sequelize,
    modelName: 'Reclamo',
  });
  return Reclamo;
};
