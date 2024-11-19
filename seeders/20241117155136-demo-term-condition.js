'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const Term_conditions = [
      {
        term_condition: "<h2>Syarat dan Ketentuan Try out</h2> <h3>1. Pendahuluan</h3> <p>Selamat datang di Master Education. Dengan mengakses dan menggunakan sistem kami, Anda setuju untuk mematuhi dan terikat oleh Syarat dan Ketentuan yang ditetapkan di bawah ini. Mohon baca dengan seksama sebelum menggunakan sistem kami.</p>",
        privacy_policy: "<h2>Privacy policy Master Educationn yang merupakan",
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('Term_conditions', Term_conditions, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Term_conditions', null, {});
  }
};
