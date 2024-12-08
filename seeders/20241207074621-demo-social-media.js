module.exports = {
  up: async (queryInterface, Sequelize) => {
    const Social_media = [
      {
        title: 'Instagram',
        link: 'https://www.instagram.com/bimbelmaster_edu?igsh=ZnRieHF0NmxmZjF0',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Facebook',
        link: 'wwww.facebook.com',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Tiktok',
        link: 'https://www.tiktok.com/@bimbelmaster_edu?_t=8rzB6snWqaw&_r=1',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Twitter',
        link: 'https://x.com',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Youtube',
        link: 'https://www.youtube.com',
        createdAt: new Date(),
        updatedAt: new Date()
      },

    ];

    await queryInterface.bulkInsert('Social_media', Social_media, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Social_media', null, {});
  }
};
