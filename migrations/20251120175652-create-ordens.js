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
          model: 'Usuarios', // nombre de tu tabla de usuarios
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      orderId: {
        type: Sequelize.STRING,
        allowNull: false
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
      note: Sequelize.TEXT,
      currency: Sequelize.STRING,
      estado: {
        type: Sequelize.STRING,
        defaultValue: 'pendiente'
      },
      subtotal: Sequelize.DECIMAL(10, 2),
      envio: Sequelize.DECIMAL(10, 2),
      total: Sequelize.DECIMAL(10, 2),
      cuponCodigo: Sequelize.STRING,
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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Ordens');
  }
};
