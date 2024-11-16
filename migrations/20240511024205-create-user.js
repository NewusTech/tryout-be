'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      password: {
        type: Sequelize.STRING
      },
      slug: {
        type: Sequelize.STRING,
        unique: true
      },
      typeuser_id: {
        type: Sequelize.INTEGER
      },
      role_id: {
        type: Sequelize.INTEGER
      },
      userinfo_id: {
        type: Sequelize.INTEGER
      },
      payment_id: {
        type: Sequelize.INTEGER
      },
      packagetryout_id: {
        type: Sequelize.INTEGER
      },
      resetpasswordtoken: {
        type: Sequelize.STRING
      },
      resetpasswordexpires: {
        type: Sequelize.DATE
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

    await queryInterface.addConstraint('Users', {
      fields: ['userinfo_id'],
      type: 'foreign key',
      name: 'custom_fkey_userinfo_id',
      references: {
        table: 'User_infos',
        field: 'id'
      }
    });
    
    await queryInterface.addConstraint('Users', {
      fields: ['role_id'],
      type: 'foreign key',
      name: 'custom_fkey_role_id',
      references: {
        table: 'Roles',
        field: 'id'
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('User_permissions');
    await queryInterface.dropTable('Users');
  }
};