const { response } = require("../helpers/response.formatter");

const {
  Schedule,
  Package_tryout,
  Type_package,
  sequelize,
} = require("../models");

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Op, Sequelize, where } = require("sequelize");
const moment = require("moment-timezone");
const { generatePagination } = require("../pagination/pagination");

module.exports = {

  //input schedule user
  createSchedule: async (req, res) => {
    try {
      const { title, packagetryout_id, tanggal, waktu } = req.body;

      // Validasi input
      if (!title || !packagetryout_id || !tanggal || !waktu) {
        return res.status(400).json(response(400, "All fields are required"));
      }

      // Cek apakah paket_tryout_id ada
      const paketTryout = await Package_tryout.findByPk(packagetryout_id);
      if (!paketTryout) {
        return res.status(404).json(response(404, "Paket tryout not found"));
      }

      // Buat schedule tryout baru
      const schedule = await Schedule.create({
        title,
        packagetryout_id,
        tanggal,
        waktu,
      });
      return res.status(201).json(response(201, "Schedule created successfully", schedule));
    } catch (error) {
      console.error(error);
      return res.status(500).json(response(500, "Internal server error", error.message));
    }
  },

  //get schedule untuk admin
  getScheduleTryout: async (req, res) => {
    try {
        const search = req.query.search ?? null;
        const showDeleted = req.query.showDeleted === "true";
        const month = parseInt(req.query.month) || null;
        const year = parseInt(req.query.year) || null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        let scheduleData;
        let totalCount;
    
        const whereCondition = {};
    
        if (search) {
          whereCondition[Op.or] = [
            {
              title: { [Op.like]: `%${search}%` },
            },
          ];
        }
    
        if (showDeleted) {
          whereCondition.deletedAt = { [Op.not]: null };
        } else {
          whereCondition.deletedAt = null;
        }
    
        if (month && year) {
          whereCondition.tanggal = {
            [Op.and]: [
              Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('tanggal')), month),
              Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('tanggal')), year),
            ],
          };
        } else if (year) {
          whereCondition.tanggal = Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('tanggal')), year);
        }
    
        [scheduleData, totalCount] = await Promise.all([
          Schedule.findAll({
            where: whereCondition,
            include: [
              {
                model: Package_tryout,
                attributes: ["id", "title"], 
              },
            ],
            limit: limit,
            offset: offset,
            order: [["tanggal", "ASC"], ["waktu", "ASC"]],
          }),
          Schedule.count({
            where: whereCondition,
          }),
        ]);
    
        // Modifikasi hasil untuk mencocokkan struktur yang diinginkan
        const modifiedScheduleData = scheduleData.map((schedule) => {
          const { id, packagetryout_id, title, tanggal, waktu, deletedAt, createdAt, updatedAt, Package_tryout } = schedule.dataValues; 
          return {
            id: id, 
            scheduleTitle: title, 
            packagetryout_id: packagetryout_id, 
            packageTryoutTitle: Package_tryout?.title, 
            tanggal: tanggal, 
            waktu: waktu, 
            deletedAt: deletedAt, 
            createdAt: createdAt, 
            updatedAt: updatedAt
          };
        });
    
        const pagination = generatePagination(totalCount, page, limit, "/api/user/tryout/schedule/get");
    
        res.status(200).json({
          status: 200,
          message: "Success get schedule tryout",
          data: modifiedScheduleData,
          pagination: pagination,
        });
      } catch (err) {
        res.status(500).json({
          status: 500,
          message: "Internal server error",
          error: err.message,
        });
        console.log(err);
        logger.error(`Error: ${err}`);
        logger.error(`Error message: ${err.message}`);
      }
  },

  //get schedule untuk user
  getUserScheduleTryout: async (req, res) => {
    try {
        const search = req.query.search ?? null;

        const whereCondition = {};

        if (search) {
            whereCondition[Op.or] = [
                {
                    title: { [Op.like]: `%${search}%` },
                },
            ];
        }

        const currentDate = moment().format('YYYY-MM-DD');
        const currentTime = new Date();
        const thirtyMinutesBeforeNow = new Date(currentTime.getTime() - 30 * 60 * 1000); 

        //filter jadwal pada hari ini dan bisa dilihat pada H-30 menit sebelum waktu mulai
        whereCondition[Op.and] = [
            Sequelize.where(Sequelize.col('tanggal'), currentDate),
            Sequelize.literal(`STR_TO_DATE(CONCAT(tanggal, ' ', waktu), '%Y-%m-%d %H:%i:%s') >= '${thirtyMinutesBeforeNow.toISOString()}'`)
        ];

        //query untuk mengambil data schedule sesuai filter
        const scheduleData = await Schedule.findAll({
            where: whereCondition,
            include: [
                {
                    model: Package_tryout,
                    attributes: ["id", "title"], 
                },
            ],
            order: [["tanggal", "ASC"], ["waktu", "ASC"]],
        });

        const modifiedScheduleData = scheduleData.map((schedule) => {
            const { id, packagetryout_id, title, tanggal, waktu, createdAt, updatedAt, Package_tryout } = schedule.dataValues; 
            
            const startDateTime = moment(`${tanggal} ${waktu}`, 'YYYY-MM-DD HH:mm:ss');
            const currentTime = moment();
            
            let status;
            let timeLeftMinutes = startDateTime.diff(currentTime, 'minutes'); 

            if (timeLeftMinutes > 0) {
                status = `Tryout akan dimulai dalam ${timeLeftMinutes} menit`;
            } else if (timeLeftMinutes <= 0 && timeLeftMinutes > -120) {
                status = `Tryout sedang berlangsung`;
            } else {
                status = `Tryout sudah selesai`;
            }

            return {
                id: id, 
                scheduleTitle: title, 
                packagetryout_id: packagetryout_id, 
                packageTryoutTitle: Package_tryout?.title ?? 'Tidak Ditemukan', 
                tanggal: moment(tanggal).format('D MMMM YYYY'), 
                waktu: waktu, 
                status: status, 
                timeLeftMinutes: timeLeftMinutes > 0 ? timeLeftMinutes : 0, 
                createdAt: moment(createdAt).format('D MMMM YYYY HH:mm:ss'), 
                updatedAt: moment(updatedAt).format('D MMMM YYYY HH:mm:ss')
            };
        });

        res.status(200).json({
            status: 200,
            message: "Success get schedule tryout",
            data: modifiedScheduleData
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Internal server error",
            error: err.message,
        });
        console.log(err);
    }
  },

  //get data schedule berdasarkan id
  getSchedulById: async (req, res) => {
    try {
        let ScheduleGet = await Schedule.findOne({
            where: {
                id: req.params.id
            },
        });

        //cek jika schedue tidak ada
        if (!ScheduleGet) {
            res.status(404).json(response(404, 'Schedule not found'));
            return;
        }
        res.status(200).json(response(200, 'success get Schedule by id', ScheduleGet));
    } catch (err) {
        res.status(500).json(response(500, 'internal server error', err));
        console.log(err);
    }
  },

};
