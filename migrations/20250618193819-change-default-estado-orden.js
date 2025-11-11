'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Ordens', 'estado', {
      type: Sequelize.STRING,
      defaultValue: 'completado',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Ordens', 'estado', {
      type: Sequelize.STRING,
      defaultValue: 'pendiente',
    });
  }
};
