'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint('Productos', {
      fields: ['categoriaId'],
      type: 'foreign key',
      name: 'fk_productos_categoriaId',
      references: {
        table: 'Categoria', 
        field: 'id'
      },
      onDelete: 'SET NULL',    
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Productos', 'fk_productos_categoriaId');
  }
};
