const { response } = require("../helpers/response.formatter");

const {
  Schedule,
  Package_tryout,
  Type_package,
  Question_form,
  Question_form_num,
  Question_form_input,
  User_info,
  Bank_package,
  Bank_soal,
  Type_question,
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
      const { title, packagetryout_id, tanggal, waktu, isEvent } = req.body;

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
        isEvent: isEvent ?? 1,
      });
      return res
        .status(201)
        .json(response(201, "Schedule created successfully", schedule));
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json(response(500, "Internal server error", error.message));
    }
  },

  //get schedule untuk admin
  getScheduleTryout: async (req, res) => {
    try {
      const search = req.query.search ?? null;
      const showDeleted = req.query.showDeleted === "true";
      const startDate = req.query.startDate ?? null;
      const endDate = req.query.endDate ?? null;
      const month = parseInt(req.query.month) || null;
      const year = parseInt(req.query.year) || null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      let scheduleData;
      let totalCount;

      const whereCondition = {};

      //filter search
      if (search) {
        whereCondition[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { "$Package_tryout.title$": { [Op.like]: `%${search}%` } },
        ];
      }

      //filter data softdelete
      if (showDeleted) {
        whereCondition.deletedAt = { [Op.not]: null };
      } else {
        whereCondition.deletedAt = null;
      }

      //filter arrange date
      if (startDate && endDate) {
        whereCondition.tanggal = {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        };
      } else if (startDate) {
        whereCondition.tanggal = {
          [Op.gte]: new Date(startDate),
        };
      } else if (endDate) {
        whereCondition.tanggal = {
          [Op.lte]: new Date(endDate),
        };
      }

      if (month && year) {
        whereCondition.tanggal = {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("MONTH", Sequelize.col("tanggal")),
              month
            ),
            Sequelize.where(
              Sequelize.fn("YEAR", Sequelize.col("tanggal")),
              year
            ),
          ],
        };
      } else if (year) {
        whereCondition.tanggal = Sequelize.where(
          Sequelize.fn("YEAR", Sequelize.col("tanggal")),
          year
        );
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
          order: [
            ["tanggal", "ASC"],
            ["waktu", "ASC"],
          ],
        }),
        Schedule.count({
          where: whereCondition,
          include: [
            {
              model: Package_tryout,
              attributes: [],
              where: search
                ? { title: { [Op.like]: `%${search}%` } }
                : undefined,
            },
          ],
        }),
      ]);

      const modifiedScheduleData = scheduleData.map((schedule) => {
        const {
          id,
          packagetryout_id,
          title,
          tanggal,
          waktu,
          deletedAt,
          createdAt,
          updatedAt,
          Package_tryout,
        } = schedule.dataValues;
        return {
          id: id,
          scheduleTitle: title,
          packagetryout_id: packagetryout_id,
          packageTryoutTitle: Package_tryout?.title,
          tanggal: tanggal,
          waktu: waktu,
          deletedAt: deletedAt,
          createdAt: createdAt,
          updatedAt: updatedAt,
        };
      });

      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        "/api/user/tryout/schedule/get"
      );

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

      const currentDate = moment().format("YYYY-MM-DD");
      const currentTime = new Date();
      const thirtyMinutesBeforeNow = new Date(
        currentTime.getTime() - 30 * 60 * 1000
      );

      //filter jadwal pada hari ini dan bisa dilihat pada H-30 menit sebelum waktu mulai
      whereCondition[Op.and] = [
        Sequelize.where(Sequelize.col("tanggal"), currentDate),
        Sequelize.literal(
          `STR_TO_DATE(CONCAT(tanggal, ' ', waktu), '%Y-%m-%d %H:%i:%s') >= '${thirtyMinutesBeforeNow.toISOString()}'`
        ),
      ];

      const scheduleData = await Schedule.findAll({
        where: whereCondition,
        include: [
          {
            model: Package_tryout,
            attributes: ["id", "title"],
            include: [
              {
                model: Type_package,
                attributes: ["id", "name"],
              },
            ],
          },
        ],
        order: [
          ["tanggal", "ASC"],
          ["waktu", "ASC"],
        ],
      });

      //formay data jadwal
      const modifiedScheduleData = scheduleData.map((schedule) => {
        const {
          id,
          packagetryout_id,
          title,
          tanggal,
          waktu,
          createdAt,
          updatedAt,
          Package_tryout,
        } = schedule.dataValues;

        const startDateTime = moment(
          `${tanggal} ${waktu}`,
          "YYYY-MM-DD HH:mm:ss"
        );
        const currentTime = moment();

        let status;
        let timeLeftMinutes = startDateTime.diff(currentTime, "minutes");

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
          packageTryoutTitle: Package_tryout?.title ?? "Tidak Ditemukan",
          typePackage: Package_tryout?.Type_package?.name ?? "Semua Tipe", // Menampilkan tipe paket
          tanggal: moment(tanggal).format("D MMMM YYYY"),
          waktu: waktu,
          status: status,
          timeLeftMinutes: timeLeftMinutes > 0 ? timeLeftMinutes : 0,
          createdAt: moment(createdAt).format("D MMMM YYYY HH:mm:ss"),
          updatedAt: moment(updatedAt).format("D MMMM YYYY HH:mm:ss"),
        };
      });

      res.status(200).json({
        status: 200,
        message: "Success get schedule tryout",
        data: modifiedScheduleData,
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: err.message,
      });
      console.error(err);
    }
  },

  //   getUserScheduleTryout: async (req, res) => {
  //     try {
  //         const search = req.query.search ?? null;

  //         const whereCondition = {};

  //         if (search) {
  //             whereCondition[Op.or] = [
  //                 {
  //                     title: { [Op.like]: `%${search}%` },
  //                 },
  //             ];
  //         }

  //         const currentDate = moment().format('YYYY-MM-DD');
  //         const currentTime = new Date();
  //         const thirtyMinutesBeforeNow = new Date(currentTime.getTime() - 30 * 60 * 1000);

  //         //filter jadwal pada hari ini dan bisa dilihat pada H-30 menit sebelum waktu mulai
  //         whereCondition[Op.and] = [
  //             Sequelize.where(Sequelize.col('tanggal'), currentDate),
  //             Sequelize.literal(`STR_TO_DATE(CONCAT(tanggal, ' ', waktu), '%Y-%m-%d %H:%i:%s') >= '${thirtyMinutesBeforeNow.toISOString()}'`)
  //         ];

  //         //query untuk mengambil data schedule sesuai filter
  //         const scheduleData = await Schedule.findAll({
  //             where: whereCondition,
  //             include: [
  //                 {
  //                     model: Package_tryout,
  //                     attributes: ["id", "title"],
  //                 },
  //             ],
  //             order: [["tanggal", "ASC"], ["waktu", "ASC"]],
  //         });

  //         const modifiedScheduleData = scheduleData.map((schedule) => {
  //             const { id, packagetryout_id, title, tanggal, waktu, createdAt, updatedAt, Package_tryout } = schedule.dataValues;

  //             const startDateTime = moment(`${tanggal} ${waktu}`, 'YYYY-MM-DD HH:mm:ss');
  //             const currentTime = moment();

  //             let status;
  //             let timeLeftMinutes = startDateTime.diff(currentTime, 'minutes');

  //             if (timeLeftMinutes > 0) {
  //                 status = `Tryout akan dimulai dalam ${timeLeftMinutes} menit`;
  //             } else if (timeLeftMinutes <= 0 && timeLeftMinutes > -120) {
  //                 status = `Tryout sedang berlangsung`;
  //             } else {
  //                 status = `Tryout sudah selesai`;
  //             }

  //             return {
  //                 id: id,
  //                 scheduleTitle: title,
  //                 packagetryout_id: packagetryout_id,
  //                 packageTryoutTitle: Package_tryout?.title ?? 'Tidak Ditemukan',
  //                 tanggal: moment(tanggal).format('D MMMM YYYY'),
  //                 waktu: waktu,
  //                 status: status,
  //                 timeLeftMinutes: timeLeftMinutes > 0 ? timeLeftMinutes : 0,
  //                 createdAt: moment(createdAt).format('D MMMM YYYY HH:mm:ss'),
  //                 updatedAt: moment(updatedAt).format('D MMMM YYYY HH:mm:ss')
  //             };
  //         });

  //         res.status(200).json({
  //             status: 200,
  //             message: "Success get schedule tryout",
  //             data: modifiedScheduleData
  //         });
  //     } catch (err) {
  //         res.status(500).json({
  //             status: 500,
  //             message: "Internal server error",
  //             error: err.message,
  //         });
  //         console.log(err);
  //     }
  //   },

  //get data schedule berdasarkan id
  
  getSchedulById: async (req, res) => {
    try {
      let ScheduleGet = await Schedule.findOne({
        where: {
          id: req.params.id,
        },
      });

      //cek jika schedue tidak ada
      if (!ScheduleGet) {
        res.status(404).json(response(404, "Schedule not found"));
        return;
      }
      res
        .status(200)
        .json(response(200, "success get Schedule by id", ScheduleGet));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //get live monitoring tryout
  getLiveMonitoringScoring: async (req, res) => {
    try {
      const { schedule_id } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      //schedule_id tidak diinput, kembalikan response dengan data null
      if (!schedule_id) {
        return res.status(200).json({
          code: 200,
          message: "schedule ID is not found",
          scheduleTitle: null,
          tryoutTitle: null,
          data: null,
        });
      }

      //get data schedule untuk mendapatkan package_tryout_id dan title
      const schedule = await Schedule.findOne({
        where: { id: schedule_id },
        attributes: ["id", "title", "packagetryout_id"],
        include: [
          {
            model: Package_tryout,
            attributes: ["title", "duration"],
          },
        ],
      });

      if (!schedule) {
        return res
          .status(404)
          .json({ code: 404, message: "Schedule not found" });
      }

      const tryoutId = schedule.packagetryout_id;

      //get data peserta berdasarkan tryout ID
      const participants = await Question_form_num.findAll({
        where: { packagetryout_id: tryoutId },
        include: [
          {
            model: User_info,
            attributes: ["id", "name"],
          },
        ],
        limit,
        offset: (page - 1) * limit,
      });

      if (!participants.length) {
        return res
          .status(404)
          .json({ code: 404, message: "No participants found" });
      }

      const currentTime = new Date();
      const formattedParticipants = await Promise.all(
        participants.map(async (participant) => {
          const { User_info, start_time, end_time } = participant;

          //hitung waktu tersisa
          const endTime = new Date(end_time);
          const timeRemainingMs = endTime - currentTime;
          const timeRemaining =
            timeRemainingMs > 0
              ? new Date(timeRemainingMs).toISOString().substr(11, 8)
              : "00:00:00";

          //get jawaban peserta dan hitung soal yang dikerjakan
          const answers = await Question_form_input.findAll({
            where: { questionformnum_id: participant.id },
          });

          //get bank soal berdasarkan tryout_id
          const bankPackages = await Bank_package.findAll({
            where: { packagetryout_id: tryoutId },
            include: [
              {
                model: Bank_soal,
                include: [
                  {
                    model: Type_question,
                    attributes: ["name"],
                  },
                  {
                    model: Question_form,
                    attributes: ["id"],
                  },
                ],
              },
            ],
          });

          const questionSummary = {};

          bankPackages.forEach((bankPackage) => {
            const { Bank_soal } = bankPackage;
            const typeName = Bank_soal?.Type_question?.name;

            if (!typeName) return;

            if (!questionSummary[typeName]) {
              questionSummary[typeName] = {
                totalQuestions: 0,
                answered: 0,
                passingGrade: 0, //default passing grade
              };
            }

            questionSummary[typeName].totalQuestions +=
              Bank_soal.Question_forms.length;
            questionSummary[typeName].answered += answers.filter((answer) =>
              Bank_soal.Question_forms.some(
                (question) => question.id === answer.questionform_id
              )
            ).length;

            //data passing grade
            const passingGrades = { TWK: 65, TIU: 80, TKP: 166 };
            questionSummary[typeName].passingGrade =
              passingGrades[typeName] || 0;
          });

          return {
            name: User_info.name,
            timeRemaining,
            passingGrade: Object.entries(questionSummary).map(
              ([typeName, summary]) => ({
                type: typeName,
                passingGrade: `${summary.totalQuestions * 5}/${
                  summary.passingGrade
                }`,
              })
            ),
            questionsAnswered: Object.entries(questionSummary).map(
              ([typeName, summary]) => ({
                type: typeName,
                answered: `${summary.answered}/${summary.totalQuestions}`,
              })
            ),
          };
        })
      );

      res.status(200).json({
        code: 200,
        message: "Success get live monitoring scoring",
        scheduleTitle: schedule.title,
        tryoutTitle: schedule.Package_tryout?.title,
        data: formattedParticipants,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        code: 500,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  //get history tryout monitoring
  getHistoryMonitoring: async (req, res) => {
    try {
      const { tryoutId, startDate, endDate, search } = req.query;

      // Query filter
      const whereCondition = {
        ...(tryoutId && { packagetryout_id: tryoutId }),
        ...(startDate &&
          endDate && {
            createdAt: {
              [Op.between]: [new Date(startDate), new Date(endDate)],
            },
          }),
      };

      // Ambil data tryout dari database
      const historyData = await Question_form_num.findAll({
        where: whereCondition,
        include: [
          {
            model: Package_tryout,
            attributes: ["id", "title"],
          },
          {
            model: User_info,
            attributes: ["name"],
          },
        ],
        order: [["skor", "DESC"]], // Ranking berdasarkan skor tertinggi
      });

      // Format response
      const formattedData = historyData.map((item, index) => ({
        no: index + 1,
        ranking: index + 1,
        nama: item.User_info?.name || "Unknown",
        skor: item.skor || 0,
      }));

      res.status(200).json({
        code: 200,
        message: "Success get history tryout",
        data: formattedData,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        code: 500,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
};
