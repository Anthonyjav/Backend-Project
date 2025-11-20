'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Ordens', 'orderidizipay', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'transactionid', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'paymentstatus', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'paymentresponse', {
      type: Sequelize.JSON,
      allowNull: true
    });
    await queryInterface.addColumn('Ordens', 'paymentdate', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Ordens', 'orderidizipay');
    await queryInterface.removeColumn('Ordens', 'transactionid');
    await queryInterface.removeColumn('Ordens', 'paymentstatus');
    await queryInterface.removeColumn('Ordens', 'paymentresponse');
    await queryInterface.removeColumn('Ordens', 'paymentdate');
  }
};
