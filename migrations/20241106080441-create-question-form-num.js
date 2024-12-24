'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
      await queryInterface.createTable('Question_form_nums', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        no_ujian: {
          type: Sequelize.STRING
        },
        userinfo_id: {
          type: Sequelize.INTEGER
        },
        skor: {
          type: Sequelize.STRING
        },
        packagetryout_id: {
          type: Sequelize.INTEGER
        },
        schedule_id: {
          type: Sequelize.INTEGER
        },
        sertifikat: {
          type: Sequelize.STRING
        },
        tgl_selesai: {
          type: Sequelize.DATEONLY
        },
        status: {
          type: Sequelize.SMALLINT
        },
        start_time: {
          type: Sequelize.STRING
        },
        end_time: {
          type: Sequelize.STRING
        },
        attempt: {
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
    
      await queryInterface.addConstraint('Question_form_nums', {
        fields: ['userinfo_id'],
        type: 'foreign key',
        name: 'custom_fkey_userinfo_idd',
        references: {
          table: 'User_infos',
          field: 'id'
        }
      });
    
      await queryInterface.addConstraint('Question_form_nums', {
        fields: ['packagetryout_id'],
        type: 'foreign key',
        name: 'custom_fkey_package_tryout_idd',
        references: {
          table: 'Package_tryouts',
          field: 'id'
        }
      });
    },
  

  //untuk drop table ketika melakukan revert migrations
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Question_form_nums');
  }
};