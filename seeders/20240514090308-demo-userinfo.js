'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const User_infos = [
      {
        name: 'Super Admin',
        email: 'superadmin',
        slug: "superadmin-20240620041615213",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Newus',
        slug: 'Newus-20240620041615213',
        email: 'newus@gmail.com',
        telepon: '086969696969',
        alamat: 'Bandar Lampung',
        provinsi_id: 1,
        kota_id: 1,
        tempat_lahir: 'Bandar Lampung',
        tgl_lahir: '1999-08-07',
        gender: 1,
        asal_instansi: 'Hacker Akhirat',
        image_profile: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('User_infos', User_infos, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('User_infos', null, {});
  }
};
