'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Reclamos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      usuarioId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onDelete: 'CASCADE'
      },
      ordenId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Ordens', key: 'id' },
        onDelete: 'CASCADE'
      },
      mensaje: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      estado: {
        type: Sequelize.STRING,
        defaultValue: 'completado'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Reclamos');
  }
};
