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
  //input feedback user
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

  getScheduleTryout: async (req, res) => {
    try {
        const search = req.query.search ?? null;
        // const packagetryout_id = req.query.packagetryout_id ?? null;
        const showDeleted = req.query.showDeleted === "true";
        const month = parseInt(req.query.month) || null;
        const year = parseInt(req.query.year) || null;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        let scheduleData;
        let totalCount;
    
        const whereCondition = {};
    
        // if (packagetryout_id) {
        //   whereCondition.packagetryout_id = packagetryout_id;
        // }
    
        if (search) {
          whereCondition[Op.or] = [
            {
              title: { [Op.like]: `%${search}%` },
            },
          ];
        }
    
        // Menampilkan data yang dihapus jika parameter showDeleted true
        if (showDeleted) {
          whereCondition.deletedAt = { [Op.not]: null };
        } else {
          whereCondition.deletedAt = null;
        }
    
        // Filter berdasarkan bulan dan tahun (berdasarkan tanggal)
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
                attributes: ["id", "title"], // Pastikan atribut sesuai dengan model PaketTryout
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
          const { Package_tryout, ...otherData } = schedule.dataValues;
          return {
            ...otherData,
            title: Package_tryout?.title,
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
    }
};
