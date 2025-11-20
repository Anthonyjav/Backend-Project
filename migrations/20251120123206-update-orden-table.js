'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'Productos';

    // Función reutilizable que solo agrega una columna si NO existe
    const addColumnIfNotExists = async (columnName, columnOptions) => {
      const tableInfo = await queryInterface.describeTable(table);
      if (!tableInfo[columnName]) {
        await queryInterface.addColumn(table, columnName, columnOptions);
      }
    };

    await addColumnIfNotExists('color', { type: Sequelize.STRING });
    await addColumnIfNotExists('talla', { type: Sequelize.STRING });
    await addColumnIfNotExists('cantidad', { type: Sequelize.INTEGER });
    await addColumnIfNotExists('composicion', { type: Sequelize.TEXT });
    await addColumnIfNotExists('info', { type: Sequelize.TEXT });
    await addColumnIfNotExists('cuidados', { type: Sequelize.TEXT });
    await addColumnIfNotExists('seleccionado', { 
      type: Sequelize.BOOLEAN, 
      defaultValue: false 
    });
  },

  async down(queryInterface, Sequelize) {
    // Puedes dejar esto vacío para no romper nada
  }
};
