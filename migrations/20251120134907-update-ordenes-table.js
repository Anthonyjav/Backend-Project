'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('"Ordens"', 'subtotal', {
      type: Sequelize.DECIMAL(10,2)
    });

    await queryInterface.changeColumn('"Ordens"', 'envio', {
      type: Sequelize.DECIMAL(10,2)
    });

    await queryInterface.addColumn('"Ordens"', 'orderId', {
      type: Sequelize.STRING,
      allowNull: false
    });

    await queryInterface.addColumn('"Ordens"', 'currency', {
      type: Sequelize.STRING
    });

    await queryInterface.addColumn('"Ordens"', 'note', {
      type: Sequelize.TEXT
    });

    await queryInterface.changeColumn('"Ordens"', 'estado', {
      type: Sequelize.STRING,
      defaultValue: 'pendiente'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('"Ordens"', 'orderId');
    await queryInterface.removeColumn('"Ordens"', 'currency');
    await queryInterface.removeColumn('"Ordens"', 'note');

    await queryInterface.changeColumn('"Ordens"', 'subtotal', {
      type: Sequelize.FLOAT
    });

    await queryInterface.changeColumn('"Ordens"', 'envio', {
      type: Sequelize.FLOAT
    });

    await queryInterface.changeColumn('"Ordens"', 'estado', {
      type: Sequelize.STRING,
      defaultValue: 'completado'
    });
  }
};
