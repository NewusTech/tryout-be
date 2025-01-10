'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    
    await queryInterface.renameColumn('Schedules', 'tanggal', 'start_date');

    await queryInterface.renameColumn('Schedules', 'waktu', 'start_time');

    await queryInterface.addColumn('Schedules', 'end_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn('Schedules', 'end_time', {
      type: Sequelize.TIME,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn('Schedules', 'tanggal', 'start_date');

    await queryInterface.renameColumn('Schedules', 'waktu', 'start_time');

    // Rollback add column
    await queryInterface.removeColumn('Schedules', 'end_date');

    await queryInterface.removeColumn('Schedules', 'end_time');
  },
};
