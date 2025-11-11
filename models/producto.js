'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Producto extends Model {
    static associate(models) {
      Producto.belongsTo(models.Categoria, {
        foreignKey: 'categoriaId',
        as: 'categoria',
        onDelete: 'SET NULL',     
        onUpdate: 'CASCADE'
      });
    }
  }

  Producto.init({
    nombre: DataTypes.STRING,
    descripcion: DataTypes.STRING,
    precio: DataTypes.FLOAT,
    imagen: {
      type: DataTypes.TEXT,
      get() {
        const raw = this.getDataValue('imagen');
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue('imagen', JSON.stringify(value));
      }
    },
    categoriaId: DataTypes.INTEGER,

    color: DataTypes.STRING,        
    talla: DataTypes.STRING,         
    cantidad: DataTypes.INTEGER,     
    composicion: DataTypes.STRING,   
    info: DataTypes.TEXT,             
    cuidados: DataTypes.TEXT,
    seleccionado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }         
  }, {
    sequelize,
    modelName: 'Producto',
  });

  return Producto;
};
