'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Package_tryouts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      // user_id: {
      //   type: Sequelize.INTEGER
      // },
      title: {
        type: Sequelize.STRING
      },
      slug: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
      },
      duration: {
        type: Sequelize.STRING
      },
      price: {
        type: Sequelize.STRING
      },
      typepackage_id: {
        type: Sequelize.INTEGER
      },
      total_question: {
        type: Sequelize.STRING
      },
      duration: {
        type: Sequelize.STRING
      },
      isEvent: {
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('Package_tryouts', {
      fields: ['typepackage_id'],
      type: 'foreign key',
      name: 'custom_fkey_type_package_id',
      references: {
        table: 'Type_packages',
        field: 'id'
      }
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Package_tryouts');
  }
};