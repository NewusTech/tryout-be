module.exports = {
  up: async (queryInterface, Sequelize) => {
    const Type_payments = [
      {
        title: 'Bank Transfer',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Cash',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('Type_payments', Type_payments, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Type_payments', null, {});
  }
};
