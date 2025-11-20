'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'Productos';

    // Solo agrega la columna si NO existe
    const tableInfo = await queryInterface.describeTable(table);

    if (!tableInfo['seleccionado']) {
      await queryInterface.addColumn(table, 'seleccionado', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      });
    }
  },

  async down(queryInterface, Sequelize) {
    // Evitar eliminar columnas en rollback
  }
};
