'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ordenitems', 'imagen', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('ordenitems', 'color', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('ordenitems', 'imagen');
    await queryInterface.removeColumn('ordenitems', 'color');
  }
};