'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const Permissions = [
      {
        name: 'Master Data',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Read Master Data',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Create and Edit Master Data',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Delete Master Data',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('Permissions', Permissions, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Permissions', null, {});
  }
};
