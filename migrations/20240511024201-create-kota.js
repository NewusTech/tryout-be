'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Kotas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      provinsi_id: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('Kotas', {
      fields: ['provinsi_id'],
      type: 'foreign key',
      name: 'custom_fkey_provinsi_id',
      references: {
        table: 'Provinsis',
        field: 'id'
      }
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Kotas');
  }
};