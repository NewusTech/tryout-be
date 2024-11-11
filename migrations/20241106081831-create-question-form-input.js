'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Question_form_inputs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      data: {
        type: Sequelize.STRING
      },
      questionform_id: {
        type: Sequelize.INTEGER
      },
      questionformnum_id: {
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

    await queryInterface.addConstraint('Question_form_inputs', {
      fields: ['questionform_id'],
      type: 'foreign key',
      name: 'custom_fkey_questionform_id',
      references: {
        table: 'Question_forms',
        field: 'id'
      }
    });

    await queryInterface.addConstraint('Question_form_inputs', {
      fields: ['questionformnum_id'],
      type: 'foreign key',
      name: 'custom_fkey_questionformnum_id',
      references: {
        table: 'Question_form_nums',
        field: 'id'
      }
    });
  },

  //untuk drop table ketika melakukan revert migrations
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Question_form_inputs');
  }
};