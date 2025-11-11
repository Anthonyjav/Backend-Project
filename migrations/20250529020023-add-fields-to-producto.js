'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Productos', 'color', {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn('Productos', 'talla', {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn('Productos', 'cantidad', {
      type: Sequelize.INTEGER,
    });
    await queryInterface.addColumn('Productos', 'composicion', {
      type: Sequelize.STRING,
    });
    await queryInterface.addColumn('Productos', 'info', {
      type: Sequelize.TEXT,
    });
    await queryInterface.addColumn('Productos', 'cuidados', {
      type: Sequelize.TEXT,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Productos', 'color');
    await queryInterface.removeColumn('Productos', 'talla');
    await queryInterface.removeColumn('Productos', 'cantidad');
    await queryInterface.removeColumn('Productos', 'composicion');
    await queryInterface.removeColumn('Productos', 'info');
    await queryInterface.removeColumn('Productos', 'cuidados');
  }
};
