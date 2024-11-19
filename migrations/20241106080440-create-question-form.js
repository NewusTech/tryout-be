'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Question_forms', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      banksoal_id: {
        type: Sequelize.INTEGER
      },
      field: {
        type: Sequelize.STRING
      },
      tipedata: {
        type: Sequelize.STRING
      },
      datajson: {
        type: Sequelize.JSON
      },
      status: {
        type: Sequelize.BOOLEAN
      },
      correct_answer: {
        type: Sequelize.JSON
      },
      discussion: {
        type: Sequelize.STRING
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

    // await queryInterface.addConstraint('Question_forms', {
    //   fields: ['packagetryout_id'],
    //   type: 'foreign key',
    //   name: 'custom_fkey_package_tryout_id',
    //   references: {
    //     table: 'Package_tryouts',
    //     field: 'id'
    //   }
    // });

    // await queryInterface.addConstraint('Question_forms', {
    //   fields: ['typequestion_id'],
    //   type: 'foreign key',
    //   name: 'custom_fkey_type_question_id',
    //   references: {
    //     table: 'Type_questions',
    //     field: 'id'
    //   }
    // });
  },

  //untuk drop table ketika melakukan revert migrations
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Question_forms');
  }
};