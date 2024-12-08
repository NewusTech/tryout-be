module.exports = {
  up: async (queryInterface, Sequelize) => {
    const Setting_sertifikats = [
      {
        title: 'Master Edu',
        name: 'Agus',
        sign: 'https://newus-bucket.s3.ap-southeast-2.amazonaws.com/newus_lokal/sign/1733670521467-signature_maker_after_.webp',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('Setting_sertifikats', Setting_sertifikats, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Setting_sertifikats', null, {});
  }
};
