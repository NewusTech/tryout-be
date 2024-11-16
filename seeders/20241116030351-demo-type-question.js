module.exports = {
  up: async (queryInterface, Sequelize) => {
    const Type_questions = [
      {
        name: 'TWK',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'TIU',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'TKP',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('Type_questions', Type_questions, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Type_questions', null, {});
  }
};
