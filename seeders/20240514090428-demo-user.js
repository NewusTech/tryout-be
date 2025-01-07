'use strict';

const passwordHash = require('password-hash');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const users = [
      {
        userinfo_id: 1,
        password: passwordHash.generate('123456'),
        slug: "superadmin-20240620041615213",
        role_id: 1,
        isVerified: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userinfo_id: 2,
        password: passwordHash.generate('123456'),
        slug: "Newus-20240620041615213",
        role_id: 2,
        isVerified: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('Users', users, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', null, {});
  }
};
