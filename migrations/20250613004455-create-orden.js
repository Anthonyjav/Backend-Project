'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Ordens', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      usuarioId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Usuarios',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      nombre: Sequelize.STRING,
      apellido: Sequelize.STRING,
      email: Sequelize.STRING,
      telefono: Sequelize.STRING,
      pais: Sequelize.STRING,
      departamento: Sequelize.STRING,
      provincia: Sequelize.STRING,
      distrito: Sequelize.STRING,
      direccion: Sequelize.STRING,
      referencia: Sequelize.STRING,
      metodoEnvio: Sequelize.STRING,
      estado: {
        type: Sequelize.STRING,
        defaultValue: 'pendiente'
      },
      subtotal: Sequelize.FLOAT,
      envio: Sequelize.FLOAT,
      total: Sequelize.FLOAT,
      cuponCodigo: Sequelize.STRING,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Ordens');
  }
};
