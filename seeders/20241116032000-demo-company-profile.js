module.exports = {
  up: async (queryInterface, Sequelize) => {
    const About_companies = [
      {
        title: 'Master Education',
        sub_title: 'Transformasi Masa Depan Tanpa Batas ! ✨',
        description: 'Kami hadir untuk mewujudkan mimpi semua orang bisa kuliah gratis, baik di dalam maupun luar negeri. Dapatkan bimbingan khusus Perguruan Tinggi Kedinasan dan beasiswa eksklusif hingga jenjang Master Degree. Siapkan dirimu dengan kurikulum terbaik, termasuk IELTS & TOEFL.',
        telepon: '6282112345673',
        main_logo: 'https://newus-bucket.s3.ap-southeast-2.amazonaws.com/newus_lokal/company_profile/1731727560657-Frame 1597884264.png',
        sub_logo: 'https://newus-bucket.s3.ap-southeast-2.amazonaws.com/newus_lokal/company_profile/1731727561578-Logomark-gold 1.png',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];

    await queryInterface.bulkInsert('About_companies', About_companies, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('About_companies', null, {});
  }
};
