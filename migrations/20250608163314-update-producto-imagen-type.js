'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Productos', 'imagen', {
      type: Sequelize.TEXT('long'), // Cambia a LONGTEXT
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Productos', 'imagen', {
      type: Sequelize.TEXT, // Vuelve al tipo TEXT original
      allowNull: true
    });
  }
};
