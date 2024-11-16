module.exports = {
  up: async (queryInterface, Sequelize) => {
    const Type_packages = [
      {
        name: 'Free',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Premium',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Platinum',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('Type_packages', Type_packages, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Type_packages', null, {});
  }
};
