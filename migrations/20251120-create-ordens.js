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
          model: 'Usuarios', // asegúrate que la tabla de usuarios se llame exactamente así
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
      subtotal: Sequelize.DECIMAL(10,2),
      envio: Sequelize.DECIMAL(10,2),
      total: Sequelize.DECIMAL(10,2),
      cuponCodigo: Sequelize.STRING,
      orderIdIzipay: Sequelize.STRING,
      transactionId: Sequelize.STRING,
      paymentStatus: Sequelize.STRING,
      paymentResponse: Sequelize.TEXT,
      paymentDate: Sequelize.DATE,
      orderidizipay: Sequelize.STRING,
      transactionid: Sequelize.STRING,
      paymentstatus: Sequelize.STRING,
      paymentresponse: Sequelize.TEXT,
      paymentdate: Sequelize.DATE,
      orderId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      currency: Sequelize.STRING,
      note: Sequelize.TEXT,
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Ordens');
  }
};
