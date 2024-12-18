const { response } = require('../helpers/response.formatter');

const { User, Role, Bank_soal, Package_tryout, Type_package, User_feedback, User_info, Question_form_num } = require('../models');
const { generatePagination } = require('../pagination/pagination');
const { Op, Sequelize } = require('sequelize');
const moment = require('moment-timezone');
const { finished } = require('nodemailer/lib/xoauth2');

module.exports = {
    
    // get dashboard superadmin
    // getDashboardSuperadmin: async (req, res) => {
    //     try {
    //         const { year, start_date, end_date, search, page, limit } = req.query;
        
    //         const currentYear = parseInt(year) || new Date().getFullYear();
    //         const pageNumber = parseInt(page) || 1;
    //         const pageSize = parseInt(limit) || 10;
    //         const offset = (pageNumber - 1) * pageSize;
        
    //         const whereClause = {};
    //         if (search) {
    //             whereClause.name = { [Op.like]: `%${search}%` };
    //         }
    
    //         const whereClause2 = {};
    //         if (start_date && end_date) {
    //             whereClause2.createdAt = { [Op.between]: [new Date(start_date), new Date(end_date)] };
    //         } else if (start_date) {
    //             whereClause2.createdAt = { [Op.gte]: new Date(start_date) };
    //         } else if (end_date) {
    //             whereClause2.createdAt = { [Op.lte]: new Date(end_date) };
    //         }
    
    //         // Query data utama
    //         const [totalUser, totalPackageTryout, totalBankSoal, allPackageTypes, usersByPackageType, monthlyTryoutData] = await Promise.all([
    //             // Total user dengan role_id = 2
    //             User.count({
    //                 where: { role_id: 2 }
    //             }),
    
    //             // Total package tryout
    //             Package_tryout.count({}),
    
    //             // Total bank soal
    //             Bank_soal.count({}),
    
    //             Type_package.findAll({
    //                 attributes: ['name']
    //             }),
    
    //             // User berdasarkan type package
    //             User.findAll({
    //                 attributes: [
    //                     [Sequelize.col('Type_package.name'), 'type_package'],
    //                     [Sequelize.fn('COUNT', Sequelize.col('User.id')), 'user_count']
    //                 ],
    //                 include: [{
    //                     model: Type_package,
    //                     attributes: [],
    //                 }],
    //                 group: ['Type_package.name'], 
    //                 order: [[Sequelize.fn('COUNT', Sequelize.col('User.id')), 'DESC']]
    //             }),
    
    //             // Total user yang mengerjakan tryout tiap bulan
    //             Question_form_num.findAll({
    //                 attributes: [
    //                     [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'month_number'], 
    //                     [Sequelize.fn('COUNT', Sequelize.col('userinfo_id')), 'user_count'] 
    //                 ],
    //                 where: Sequelize.where(
    //                     Sequelize.fn('YEAR', Sequelize.col('createdAt')), 
    //                     currentYear
    //                 ),
    //                 group: [Sequelize.fn('MONTH', Sequelize.col('createdAt'))], 
    //                 order: [[Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'ASC']]
    //             })
    //         ]);
    
    //         // Format data bulanan tryout
    //         const monthNames = [
    //             "January", "February", "March", "April", "May", "June",
    //             "July", "August", "September", "October", "November", "December"
    //         ];
    
    //         const monthlyTryoutFormatted = monthlyTryoutData.map((item) => ({
    //             month: monthNames[item.dataValues.month_number - 1], // Konversi nomor bulan ke nama bulan
    //             user_count: parseInt(item.dataValues.user_count, 10)
    //         }));
    
    //         // Format usersByPackageType
    //         const usersByPackageTypeMap = usersByPackageType.reduce((acc, item) => {
    //             acc[item.dataValues.type_package] = parseInt(item.dataValues.user_count, 10);
    //             return acc;
    //         }, {});
    
    //         const usersByPackageTypeFormatted = allPackageTypes.map((type) => ({
    //             type_package: type.name,
    //             user_count: usersByPackageTypeMap[type.name] || 0
    //         }));
    
    //         // Response JSON
    //         const data = {
    //             totalUser,
    //             totalPackageTryout, 
    //             totalBankSoal,
    //             usersByPackageType: usersByPackageTypeFormatted,
    //             tryoutMonthly: monthlyTryoutFormatted
    //         };
    
    //         res.status(200).json(response(200, 'success get data dashboard', data));
    //     } catch (err) {
    //         console.error(err);
    //         res.status(500).json(response(500, 'internal server error', err));
    //     }
    // },

    getDashboardSuperadmin: async (req, res) => {
        try {
            const { year, start_date, end_date, search, page, limit } = req.query;
        
            const currentYear = parseInt(year) || new Date().getFullYear();
            const pageNumber = parseInt(page) || 1;
            const pageSize = parseInt(limit) || 10;
            const offset = (pageNumber - 1) * pageSize;
        
            const whereClause = {};
            if (search) {
                whereClause.name = { [Op.like]: `%${search}%` };
            }
    
            const whereClause2 = {};
            if (start_date && end_date) {
                whereClause2.createdAt = { [Op.between]: [new Date(start_date), new Date(end_date)] };
            } else if (start_date) {
                whereClause2.createdAt = { [Op.gte]: new Date(start_date) };
            } else if (end_date) {
                whereClause2.createdAt = { [Op.lte]: new Date(end_date) };
            }
    
            // Query data utama
            const [totalUser, totalPackageTryout, totalBankSoal, allPackageTypes, usersByPackageType, monthlyTryoutData, totalLulus, totalTidakLulus] = await Promise.all([
                // Total user dengan role_id = 2
                User.count({
                    where: { role_id: 2 }
                }),
    
                // Total package tryout
                Package_tryout.count({}),
    
                // Total bank soal
                Bank_soal.count({}),
    
                Type_package.findAll({
                    attributes: ['name']
                }),
    
                // User berdasarkan type package
                User.findAll({
                    attributes: [
                        [Sequelize.col('Type_package.name'), 'type_package'],
                        [Sequelize.fn('COUNT', Sequelize.col('User.id')), 'user_count']
                    ],
                    include: [{
                        model: Type_package,
                        attributes: [],
                    }],
                    group: ['Type_package.name'], 
                    order: [[Sequelize.fn('COUNT', Sequelize.col('User.id')), 'DESC']]
                }),
    
                // Total user yang mengerjakan tryout tiap bulan
                Question_form_num.findAll({
                    attributes: [
                        [Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'month_number'], 
                        [Sequelize.fn('COUNT', Sequelize.col('userinfo_id')), 'user_count'] 
                    ],
                    where: Sequelize.where(
                        Sequelize.fn('YEAR', Sequelize.col('createdAt')), 
                        currentYear
                    ),
                    group: [Sequelize.fn('MONTH', Sequelize.col('createdAt'))], 
                    order: [[Sequelize.fn('MONTH', Sequelize.col('createdAt')), 'ASC']]
                }),
    
                // Total Lulus
                Question_form_num.count({
                    where: {
                        status: "Lulus",
                        ...whereClause2,
                    }
                }),
    
                // Total Tidak Lulus
                Question_form_num.count({
                    where: {
                        status: "Tidak Lulus",
                        ...whereClause2,
                    }
                })
            ]);
    
            // Format data bulanan tryout
            const monthNames = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
    
            let monthlyTryoutFormatted = monthNames.map((month, index) => ({
                month: month,
                user_count: 0 // Default nilai user_count
            }));
    
            monthlyTryoutData.forEach((item) => {
                const monthIndex = item.dataValues.month_number - 1; // Bulan diambil dari 1-12
                if (monthlyTryoutFormatted[monthIndex]) {
                    monthlyTryoutFormatted[monthIndex].user_count = parseInt(item.dataValues.user_count, 10);
                }
            });
    
            // Format usersByPackageType
            const usersByPackageTypeMap = usersByPackageType.reduce((acc, item) => {
                acc[item.dataValues.type_package] = parseInt(item.dataValues.user_count, 10);
                return acc;
            }, {});
    
            const usersByPackageTypeFormatted = allPackageTypes.map((type) => ({
                type_package: type.name,
                user_count: usersByPackageTypeMap[type.name] || 0
            }));
    
            // Response JSON
            const data = {
                totalUser,
                totalPackageTryout, 
                totalBankSoal,
                usersByPackageType: usersByPackageTypeFormatted,
                tryoutMonthly: monthlyTryoutFormatted,
                tryoutStatus: {
                    totalLulus,
                    totalTidakLulus
                }
            };
    
            res.status(200).json(response(200, 'success get data dashboard', data));
        } catch (err) {
            console.error(err);
            res.status(500).json(response(500, 'internal server error', err));
        }
    },
    
    
    
    
    

}