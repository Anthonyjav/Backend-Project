'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Ordens', 'orderIdIzipay', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'transactionId', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'paymentStatus', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'paymentResponse', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'paymentDate', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Ordens', 'orderIdIzipay');
    await queryInterface.removeColumn('Ordens', 'transactionId');
    await queryInterface.removeColumn('Ordens', 'paymentStatus');
    await queryInterface.removeColumn('Ordens', 'paymentResponse');
    await queryInterface.removeColumn('Ordens', 'paymentDate');
  }
};
