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
const puppeteer = require('puppeteer');
const axios = require("axios");
const Validator = require("fastest-validator");
const v = new Validator();
const { generatePagination } = require("../pagination/pagination");

module.exports = {

  //input schedule user
  createSchedule: async (req, res) => {
    try {
        const {
            title,
            packagetryout_id,
            start_date,
            end_date,
            start_time,
            end_time,
            isEvent,
        } = req.body;

        // Validasi input
        if (!title || !packagetryout_id || !start_date || !end_date || !start_time || !end_time) {
            return res.status(400).json(response(400, "All fields are required"));
        }

        // Validasi apakah paket_tryout_id ada
        const paketTryout = await Package_tryout.findByPk(packagetryout_id);
        if (!paketTryout) {
            return res.status(404).json(response(404, "Paket tryout not found"));
        }

        // Pastikan tanggal dan waktu valid
        const startDateTime = new Date(`${start_date}T${start_time}`);
        const endDateTime = new Date(`${end_date}T${end_time}`);
        if (startDateTime >= endDateTime) {
            return res
                .status(400)
                .json(response(400, "End date and time must be after start date and time"));
        }

        // Buat schedule baru
        const schedule = await Schedule.create({
            title,
            packagetryout_id,
            start_date,
            end_date,
            start_time,
            end_time,
            isEvent: isEvent ?? 1,
        });

        // Update isEvent di tabel Package_tryout
        await paketTryout.update({
            isEvent: 1,
        });

        return res.status(201).json(response(201, "Schedule created successfully", schedule));
    } catch (error) {
        console.error(error);
        return res.status(500).json(response(500, "Internal server error", error.message));
    }
  },

  updateSchedule: async (req, res) => {
    try {
      let ScheduleGet = await Schedule.findOne({
        where: {
          id: req.params.id,
        },
      });

      if (!ScheduleGet) {
        res.status(404).json(response(404, "Schedule not found"));
        return;
      }

      // Membuat schema untuk validasi
      const schema = {
        title: { type: "string", optional: true },
        packagetryout_id: { type: "string", optional: true },
        start_date: { type: "string", optional: true },
        end_date: { type: "string", optional: true },
        start_time: { type: "string", optional: true },
        end_time: { type: "string", optional: true },
        isEvent: { type: "number", optional: true },
      };

      let ScheduleUpdateObj = {
        title: req.body.title,
        packagetryout_id: req.body.packagetryout_id,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        start_time: req.body.start_time,
        end_time: req.body.end_time,
        isEvent: 1
      };

      // Validasi menggunakan module fastest-validator
      const validate = v.validate(ScheduleUpdateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "validation failed", validate));
        return;
      }

      // Update Schedule
      await Schedule.update(ScheduleUpdateObj, {
        where: { id: req.params.id },
      });

      let ScheduleAfterUpdate = await Schedule.findOne({
        where: { id: req.params.id },
      });

      res.status(200).json(response(200, "success update Schedule", ScheduleAfterUpdate)
        );
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
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
            ["start_date", "ASC"],
            ["start_time", "ASC"],
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
          start_date,
          start_time,
          end_date,
          end_time,
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
          start_date : start_date,
          start_time : start_time,
          end_date : end_date,
          end_time : end_time,
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

          const currentDateTime = moment().format("YYYY-MM-DD HH:mm:ss"); // Waktu sekarang dalam format SQL

          // Filter jadwal berdasarkan waktu aktif
          whereCondition[Op.and] = [
            Sequelize.literal(
                `STR_TO_DATE(CONCAT(start_date, ' ', start_time), '%Y-%m-%d %H:%i:%s') <= '${currentDateTime}'`
            ),
            Sequelize.literal(
                `STR_TO_DATE(CONCAT(end_date, ' ', end_time), '%Y-%m-%d %H:%i:%s') >= '${currentDateTime}'`
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
              ["start_date", "ASC"],
              ["start_time", "ASC"],
          ],
      });

          const modifiedScheduleData = scheduleData.map((schedule) => {
              const {
                  id,
                  packagetryout_id,
                  title,
                  start_date,
                  end_date,
                  start_time,
                  end_time,
                  createdAt,
                  updatedAt,
                  Package_tryout,
              } = schedule.dataValues;

              const currentTime = moment();
              const startDateTime = moment(
                  `${start_date} ${start_time}`,
                  "YYYY-MM-DD HH:mm:ss"
              );
              const endDateTime = moment(
                  `${end_date} ${end_time}`,
                  "YYYY-MM-DD HH:mm:ss"
              );

              let status;
              if (currentTime.isBefore(startDateTime)) {
                  const timeLeftMinutes = startDateTime.diff(currentTime, "minutes");
                  status = `Tryout akan dimulai dalam ${timeLeftMinutes} menit`;
              } else if (currentTime.isBetween(startDateTime, endDateTime)) {
                  status = `Tryout sedang berlangsung`;
              } else {
                  status = `Tryout sudah selesai`;
              }

              return {
                  id: id,
                  scheduleTitle: title,
                  packagetryout_id: packagetryout_id,
                  packageTryoutTitle: Package_tryout?.title ?? "Tidak Ditemukan",
                  typePackage: Package_tryout?.Type_package?.name ?? "Semua Tipe",
                  start_date: moment(start_date).format("D MMMM YYYY"),
                  end_date: moment(end_date).format("D MMMM YYYY"),
                  start_time: start_time,
                  end_time: end_time,
                  status: status,
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
  // getLiveMonitoringScoring: async (req, res) => {
  //   try {
  //     const { schedule_id } = req.query;
  //     const page = parseInt(req.query.page) || 1;
  //     const limit = parseInt(req.query.limit) || 10;
  //     const offset = (page - 1) * limit;

  //     if (!schedule_id) {
  //       return res.status(200).json({
  //         code: 200,
  //         message: "Schedule ID is not found",
  //         scheduleTitle: null,
  //         tryoutTitle: null,
  //         data: null,
  //       });
  //     }

  //     const schedule = await Schedule.findOne({
  //       where: { id: schedule_id },
  //       attributes: ["id", "title", "packagetryout_id"],
  //       include: [
  //         {
  //           model: Package_tryout,
  //           where: { isEvent: 1 },
  //           attributes: ["title", "duration"],
  //         },
  //       ],
  //     });

  //     if (!schedule) {
  //       return res.status(404).json({
  //         code: 404,
  //         message: "Schedule not found or Package is not an event",
  //       });
  //     }

  //     const tryoutId = schedule.packagetryout_id;

  //     //get semua jenis soal (TWK, TIU, TKP) dari database
  //     const typeQuestions = await Type_question.findAll({
  //       attributes: ["id", "name"],
  //     });

  //     const defaultQuestionTypes = typeQuestions.map((type) => ({
  //       id: type.id,
  //       name: type.name,
  //     }));

  //     const passingGrades = {
  //       TWK: 65,
  //       TIU: 80,
  //       TKP: 166,
  //     };

  //     const participants = await Question_form_num.findAll({
  //       where: {
  //         packagetryout_id: tryoutId,
  //       },
  //       include: [
  //         {
  //           model: User_info,
  //           attributes: ["id", "name"],
  //         },
  //       ],
  //       limit,
  //       offset: (page - 1) * limit,
  //     });

  //     if (!participants.length) {
  //       return res.status(404).json({
  //         code: 404,
  //         message: "No participants found",
  //       });
  //     }

  //     const currentTime = new Date();
  //     const formattedParticipants = await Promise.all(
  //       participants.map(async (participant) => {
  //         const { User_info, start_time, end_time } = participant;

  //         const endTime = new Date(end_time);
  //         const timeRemainingMs = endTime - currentTime;
  //         const timeRemaining =
  //           timeRemainingMs > 0
  //             ? new Date(timeRemainingMs).toISOString().substr(11, 8)
  //             : "00:00:00";

  //         //get jawaban peserta
  //         const answers = await Question_form_input.findAll({
  //           where: { questionformnum_id: participant.id },
  //         });

  //         //get semua soal yang tersedia di tryout
  //         const bankPackages = await Bank_package.findAll({
  //           where: { packagetryout_id: tryoutId },
  //           include: [
  //             {
  //               model: Bank_soal,
  //               include: [
  //                 {
  //                   model: Type_question,
  //                   attributes: ["id", "name"],
  //                 },
  //                 {
  //                   model: Question_form,
  //                   attributes: ["id", "correct_answer"],
  //                 },
  //               ],
  //             },
  //           ],
  //         });

  //         const questionSummary = {};

  //         //inisialisasi semua tipe soal dengan nilai 0
  //         defaultQuestionTypes.forEach(({ id, name }) => {
  //           questionSummary[id] = {
  //             typeName: name,
  //             totalQuestions: 0,
  //             totalCorrect: 0,
  //             totalIncorrect: 0,
  //             totalUnanswered: 0,
  //             totalScore: 0,
  //           };
  //         });

  //         const userAnswers = {};
  //         answers.forEach((answer) => {
  //           userAnswers[answer.questionform_id] = answer.data;
  //         });

  //         bankPackages.forEach((bankPackage) => {
  //           const { Bank_soal } = bankPackage;
  //           const typeId = Bank_soal?.Type_question?.id;
  //           const typeName = Bank_soal?.Type_question?.name;

  //           if (!typeId || !typeName) return;

  //           if (!questionSummary[typeId]) {
  //             questionSummary[typeId] = {
  //               typeName: typeName,
  //               totalQuestions: 0,
  //               totalCorrect: 0,
  //               totalIncorrect: 0,
  //               totalUnanswered: 0,
  //               totalScore: 0,
  //             };
  //           }

  //           Bank_soal.Question_forms.forEach((questionForm) => {
  //             const correctAnswer = questionForm.correct_answer;
  //             const userAnswer = userAnswers[questionForm.id];
  //             let isCorrect = false;
  //             let points = 0;
            
  //             // Perbandingan jika jawaban benar adalah string atau angka
  //             if (typeof correctAnswer === "string" || typeof correctAnswer === "number") {
  //               isCorrect = String(correctAnswer) === String(userAnswer);
  //               points = isCorrect ? 5 : 0;
  //             } 
              
  //             // Perbandingan jika jawaban benar adalah array (contoh: [{id: "A", point: 5}])
  //             else if (Array.isArray(correctAnswer)) {
  //               const correctObject = correctAnswer.find(
  //                 (item) => String(item.id) === String(userAnswer)
  //               );
            
  //               if (correctObject) {
  //                 isCorrect = true;
  //                 points = correctObject.point || 5;  // Ambil skor dari objek
  //               }
  //             }
            
  //             questionSummary[typeId].totalQuestions += 1;
  //             if (userAnswer !== null && userAnswer !== undefined) {
  //               questionSummary[typeId].totalCorrect += isCorrect ? 1 : 0;
  //               questionSummary[typeId].totalIncorrect += isCorrect ? 0 : 1;
  //               questionSummary[typeId].totalScore += points;
  //             } else {
  //               questionSummary[typeId].totalUnanswered += 1;
  //             }
  //           });
            
                      
  //         });

  //         return {
  //           name: User_info?.name ?? "Anonymous",
  //           timeRemaining,
  //           passingGrade: Object.values(questionSummary).map((summary) => ({
  //             type: summary.typeName,
  //             passingGrade: `${summary.totalScore}/${
  //               passingGrades[summary.typeName] || 0
  //             }`,
  //           })),
  //           questionsAnswered: Object.values(questionSummary).map(
  //             (summary) => ({
  //               type: summary.typeName,
  //               answered: `${summary.totalCorrect}/${summary.totalQuestions}`,
  //             })
  //           ),
  //         };
  //       })
  //     );

  //     const pagination = generatePagination(
  //       totalCount,
  //       page,
  //       limit,
  //       "/user/live/mentoring/tryout/get"
  //     );

  //     res.status(200).json({
  //       code: 200,
  //       message: "Success get live monitoring scoring",
  //       scheduleTitle: schedule.title,
  //       tryoutTitle: schedule.Package_tryout?.title,
  //       data: formattedParticipants,
  //       pagination: pagination,
  //     });
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({
  //       code: 500,
  //       message: "Internal server error",
  //       error: error.message,
  //     });
  //   }
  // },

  getLiveMonitoringScoring: async (req, res) => {
    try {
      const { schedule_id } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
  
      if (!schedule_id) {
        return res.status(200).json({
          code: 200,
          message: "Schedule ID is not found",
          scheduleTitle: null,
          tryoutTitle: null,
          data: null,
        });
      }
  
      const schedule = await Schedule.findOne({
        where: { id: schedule_id },
        attributes: ["id", "title", "packagetryout_id"],
        include: [
          {
            model: Package_tryout,
            where: { isEvent: 1 },
            attributes: ["title", "duration"],
          },
        ],
      });
  
      if (!schedule) {
        return res.status(404).json({
          code: 404,
          message: "Schedule not found or Package is not an event",
        });
      }
  
      const tryoutId = schedule.packagetryout_id;
  
      const typeQuestions = await Type_question.findAll({
        attributes: ["id", "name"],
      });
  
      const defaultQuestionTypes = typeQuestions.map((type) => ({
        id: type.id,
        name: type.name,
      }));
  
      const passingGrades = {
        TWK: 65,
        TIU: 80,
        TKP: 166,
      };
  
      // Hitung total peserta untuk pagination
      const totalCount = await Question_form_num.count({
        where: {
          packagetryout_id: tryoutId,
        },
      });
  
      const participants = await Question_form_num.findAll({
        where: {
          packagetryout_id: tryoutId,
        },
        include: [
          {
            model: User_info,
            attributes: ["id", "name"],
          },
        ],
        limit,
        offset,
      });
  
      if (!participants.length) {
        return res.status(404).json({
          code: 404,
          message: "No participants found",
        });
      }
  
      const currentTime = new Date();
      const formattedParticipants = await Promise.all(
        participants.map(async (participant) => {
          const { User_info, start_time, end_time } = participant;
  
          const endTime = new Date(end_time);
          const timeRemainingMs = endTime - currentTime;
          const timeRemaining =
            timeRemainingMs > 0
              ? new Date(timeRemainingMs).toISOString().substr(11, 8)
              : "00:00:00";
  
          const answers = await Question_form_input.findAll({
            where: { questionformnum_id: participant.id },
          });
  
          const bankPackages = await Bank_package.findAll({
            where: { packagetryout_id: tryoutId },
            include: [
              {
                model: Bank_soal,
                include: [
                  {
                    model: Type_question,
                    attributes: ["id", "name"],
                  },
                  {
                    model: Question_form,
                    attributes: ["id", "correct_answer"],
                  },
                ],
              },
            ],
          });
  
          const questionSummary = {};
  
          defaultQuestionTypes.forEach(({ id, name }) => {
            questionSummary[id] = {
              typeName: name,
              totalQuestions: 0,
              totalCorrect: 0,
              totalIncorrect: 0,
              totalUnanswered: 0,
              totalScore: 0,
            };
          });
  
          const userAnswers = {};
          answers.forEach((answer) => {
            userAnswers[answer.questionform_id] = answer.data;
          });
  
          bankPackages.forEach((bankPackage) => {
            const { Bank_soal } = bankPackage;
            const typeId = Bank_soal?.Type_question?.id;
            const typeName = Bank_soal?.Type_question?.name;
  
            if (!typeId || !typeName) return;
  
            if (!questionSummary[typeId]) {
              questionSummary[typeId] = {
                typeName: typeName,
                totalQuestions: 0,
                totalCorrect: 0,
                totalIncorrect: 0,
                totalUnanswered: 0,
                totalScore: 0,
              };
            }
  
            Bank_soal.Question_forms.forEach((questionForm) => {
              const correctAnswer = questionForm.correct_answer;
              const userAnswer = userAnswers[questionForm.id];
              let isCorrect = false;
              let points = 0;
  
              if (typeof correctAnswer === "string" || typeof correctAnswer === "number") {
                isCorrect = String(correctAnswer) === String(userAnswer);
                points = isCorrect ? 5 : 0;
              } else if (Array.isArray(correctAnswer)) {
                const correctObject = correctAnswer.find(
                  (item) => String(item.id) === String(userAnswer)
                );
  
                if (correctObject) {
                  isCorrect = true;
                  points = correctObject.point || 5;
                }
              }
  
              questionSummary[typeId].totalQuestions += 1;
              if (userAnswer !== null && userAnswer !== undefined) {
                questionSummary[typeId].totalCorrect += isCorrect ? 1 : 0;
                questionSummary[typeId].totalIncorrect += isCorrect ? 0 : 1;
                questionSummary[typeId].totalScore += points;
              } else {
                questionSummary[typeId].totalUnanswered += 1;
              }
            });
          });
  
          return {
            name: User_info?.name ?? "Anonymous",
            timeRemaining,
            passingGrade: Object.values(questionSummary).map((summary) => ({
              type: summary.typeName,
              passingGrade: `${summary.totalScore}/${
                passingGrades[summary.typeName] || 0
              }`,
            })),
            questionsAnswered: Object.values(questionSummary).map(
              (summary) => ({
                type: summary.typeName,
                answered: `${summary.totalCorrect}/${summary.totalQuestions}`,
              })
            ),
          };
        })
      );
  
      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        "/user/live/mentoring/tryout/get"
      );
  
      res.status(200).json({
        code: 200,
        message: "Success get live monitoring scoring",
        scheduleTitle: schedule.title,
        tryoutTitle: schedule.Package_tryout?.title,
        data: formattedParticipants,
        pagination: pagination,
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
      const { schedule_id, startDate, endDate, search } = req.query;

      // Query filter
      const whereCondition = {
        ...(schedule_id && { packagetryout_id: schedule_id }),
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

  getPDFHistory: async (req, res) => {  
    try {  
        let package = await Package_tryout.findOne({  
            where: { id: req.params.packagetryout_id },  
            attributes: ['id', 'title'],  
        });  
  
        if (!package) {  
            return res.status(404).send('Data tidak ditemukan');  
        }  
  
        const packagetryout_id = req.params.packagetryout_id ?? null;  

        const apiURL = `${process.env.SERVER_URL}/user/data/event/${packagetryout_id}`;  
          
        let usersData = [];  

        try {  
            const apiResponse = await axios.get(apiURL);  
            if (apiResponse.data && apiResponse.data.data) {  
                usersData = apiResponse.data.data;
            }  
        } catch (err) {  
            console.error('Error fetching data from API:', err.message);  
            return res.status(500).send('Error fetching data from API');  
        }  
  
        const templatePath = path.resolve(__dirname, '../views/history_event_template.html');  
        let htmlContent = fs.readFileSync(templatePath, 'utf8');  

        const tanggalInfo = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });  
        const tahunInfo = new Date().toLocaleDateString('id-ID', { year: 'numeric' });  
  
        htmlContent = htmlContent.replace('{{packageName}}', package?.title ?? 'Tidak Ditemukan');  
        htmlContent = htmlContent.replace('{{tahunInfo}}', tahunInfo);  
        htmlContent = htmlContent.replace('{{tanggalInfo}}', tanggalInfo);  
 
        let userRows = '';  

        usersData.forEach((user, index) => {  
            const status = user.status === 'Lulus' ? 'Lulus' : 'Tidak Lulus';  
            userRows += `<tr>  
                <td>${index + 1}</td>  
                <td>${user.package_name}</td>  
                <td>${user.name}</td>  
                <td>${user.skor}</td>  
                <td>${status}</td>  
                <td>${user.rank}</td>  
            </tr>`;  
        });  

        htmlContent = htmlContent.replace('{{userRows}}', userRows);  
  
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });  
        const page = await browser.newPage();  
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });  

        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-size:15px; font-family:Arial, sans-serif; width:100%; text-align:center; padding-top:10px;">
                    <h3 style="margin:0;">Riwayat Event Tryout</h3>
                    <div style="margin-top:5px;">Tanggal: ${tanggalInfo}</div>
                </div>
            `,
            footerTemplate: `
                <div style="font-size:8px; font-family:Arial, sans-serif; width:100%; text-align:right; margin-right:10px;">
                    Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span>
                </div>
            `,
            margin: {
                top: "90px", // Ruang untuk header
                bottom: "50px", // Ruang untuk footer
                left: "20px",
                right: "20px",
            },
        });
        await browser.close();  
  
        // Create a filename for the PDF  
        const currentDate = new Date().toISOString().replace(/:/g, '-');  
        const filename = `laporan-event-${currentDate}.pdf`;  
  
        // Send the PDF as a response  
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);  
        res.setHeader('Content-type', 'application/pdf');  
        res.end(pdfBuffer);  
    } catch (err) {  
        console.error('Error generating PDF:', err);  
        res.status(500).json({  
            message: 'Internal Server Error',  
            error: err.message  
        });  
    }  
  },

  getDataForPDF: async (req, res) => {  
    try {  
        const { packagetryout_id } = req.params;
        // const page = parseInt(req.query.page) || 1;     
        // const limit = parseInt(req.query.limit) || 10;  
        // const offset = (page - 1) * limit;
        
        if (!packagetryout_id) {  
            return res.status(400).json({  
                status: 400,  
                message: "packagetryout_id is required",  
            });  
        }  
  
        const WhereClause = {      
          packagetryout_id: packagetryout_id,      
      };         

      const [histories, totalCount] = await Promise.all([      
          Question_form_num.findAll({      
              where: WhereClause,      
              include: [      
                  {      
                      model: Package_tryout,      
                      attributes: ['id', 'title', 'slug', 'description', 'duration', 'price'],      
                      include: [      
                          {      
                              model: Bank_package,      
                              attributes: ['id', 'packagetryout_id', 'banksoal_id'],      
                              include: [      
                                  {      
                                      model: Bank_soal,      
                                      attributes: ['id', 'title', 'typequestion_id'],      
                                      include: [      
                                          {      
                                              model: Type_question,      
                                              attributes: ['id', 'name'],      
                                          },      
                                          {      
                                              model: Question_form,      
                                              attributes: ['id', 'field', 'tipedata', 'datajson', 'correct_answer'],      
                                          },      
                                      ],      
                                  },      
                              ],      
                          },      
                          {      
                              model: Type_package,      
                              attributes: ['id', 'name'],      
                          },      
                      ],      
                  },      
                  {      
                      model: User_info,      
                      attributes: ['id', 'name'],      
                  },      
              ],      
              order: [['createdAt', 'DESC']],      
              // limit: null,
              // offset: null,
          }),      
          Question_form_num.count({      
              where: WhereClause,      
              include: [      
                  {      
                      model: Package_tryout,      
                      include: [      
                          {      
                              model: Type_package,      
                          },      
                      ],      
                  },      
                  {      
                      model: User_info,      
                  },      
              ],      
          }),      
      ]);      

      const scoreMinimums = {      
          'TWK': 65,      
          'TIU': 80,      
          'TKP': 166,      
      };      

      const formattedData = await Promise.all(histories.map(async (data) => {      
          if (!data.Package_tryout) {      
              return {      
                  id: data.id,      
                  message: 'Package tryout data not found',      
              };      
          }      
   
          const answers = await Question_form_input.findAll({      
              where: { questionformnum_id: data.id },      
              attributes: ['questionform_id', 'data'],      
          });      

          const userAnswers = {};      
          answers.forEach((answer) => {      
              userAnswers[answer.questionform_id] = answer.data;      
          });      

          const typeQuestionSummary = [];      
          data.Package_tryout.Bank_packages.forEach((bankPackage) => {      
              const bankSoals = Array.isArray(bankPackage.Bank_soal)       
                  ? bankPackage.Bank_soal       
                  : [bankPackage.Bank_soal].filter(Boolean);      
                    
              bankSoals.forEach((bankSoal) => {      
                  const typeQuestionId = bankSoal.typequestion_id;      
                  const typeName = bankSoal.Type_question?.name || 'Unknown';      

                  let existingSummary = typeQuestionSummary.find(      
                      (summary) => summary.typeName === typeName      
                  );      

                  if (!existingSummary) {      
                      existingSummary = {      
                          typeName,      
                          totalQuestions: 0,      
                          totalCorrect: 0,      
                          totalIncorrect: 0,      
                          totalUnanswered: 0,      
                          totalScore: 0,      
                      };      
                      typeQuestionSummary.push(existingSummary);      
                  }      

                  bankSoal.Question_forms.forEach((questionForm) => {      
                      const correctAnswer = questionForm.correct_answer;      
                      const userAnswer = userAnswers[questionForm.id];      

                      let isCorrect = false;      
                      let points = 0;      

                      if (typeof correctAnswer === 'string' || typeof correctAnswer === 'number') {      
                          isCorrect = String(correctAnswer) === String(userAnswer);      
                          points = isCorrect ? 5 : 0;  
                      } else if (Array.isArray(correctAnswer)) {      
                          const correctObject = correctAnswer.find(      
                              (item) => String(item.id) === String(userAnswer)      
                          );      
                          if (correctObject) {      
                              isCorrect = true;      
                              points = correctObject.point || 0;      
                          }      
                      }      

                      existingSummary.totalQuestions += 1;      

                      if (userAnswer !== null && userAnswer !== undefined) {      
                          if (isCorrect) {      
                              existingSummary.totalCorrect += 1;      
                              existingSummary.totalScore += points;      
                          } else {      
                              existingSummary.totalIncorrect += 1;      
                          }      
                      } else {      
                          existingSummary.totalUnanswered += 1;      
                      }      
                  });      
              });      
          });      

          let isLolos = "Lulus";      
          typeQuestionSummary.forEach((summary) => {      
              const requiredScore = scoreMinimums[summary.typeName] ?? 0;      
              if (summary.totalScore < requiredScore) {      
                  summary.status = 'Tidak Lulus';      
                  isLolos = "Tidak Lulus";      
              } else {      
                  summary.status = 'Lulus';      
              }      
          });      

          const startTime = new Date(data.start_time);      
          const endTime = new Date(data.end_time);      
          const durationMs = endTime - startTime;      
          const durationFormatted = moment.utc(durationMs).format("HH:mm:ss");      

          return {      
              id: data.id,      
              userinfo_id: data.userinfo_id,      
              name: data.User_info?.name,      
              skor: parseInt(data.skor) || 0,
              sertifikat: data.sertifikat,      
              status: isLolos,      
              duration: durationFormatted,      
              packagetryout_id: data?.packagetryout_id,      
              package_name: data?.Package_tryout ? data?.Package_tryout?.title : null,      
              typepackage_id:      
                  data?.Package_tryout && data?.Package_tryout?.Type_package      
                      ? data?.Package_tryout?.Type_package.id      
                      : null,      
              typepackage_name:      
                  data?.Package_tryout && data?.Package_tryout?.Type_package      
                      ? data?.Package_tryout?.Type_package.name      
                      : null,      
              createdAt: data?.createdAt,      
              updatedAt: data?.updatedAt,      
              typeQuestionSummary,      
          };      
      }));      

      // Pisahkan peserta dengan skor valid dan tidak valid    
      const completedData = formattedData.filter(data => data.skor > 0); 
      const notCompletedData = formattedData.filter(data => data.skor === 0);

      // Urutkan peserta yang sudah mengerjakan berdasarkan skor    
      completedData.sort((a, b) => b.skor - a.skor);      

      const finalData = [...completedData, ...notCompletedData];        
      finalData.forEach((data, index) => {      
          data.rank = index + 1;      
      });      
   
      // const paginatedData = finalData.slice(offset, offset + limit);      
 
      // const pagination = {      
      //     totalItems: finalData.length, 
      //     currentPage: page,      
      //     totalPages: Math.ceil(finalData.length / limit),      
      //     pageSize: limit,      
      //     hasNextPage: offset + limit < finalData.length,      
      //     hasPreviousPage: page > 1,      
      // };      

      res.status(200).json({      
          status: 200,      
          message: 'Success get details for package tryout',      
          data: finalData,      
          // pagination: pagination,      
      });      
  } catch (err) {      
      console.error(err);      
      res.status(500).json({      
          status: 500,      
          message: 'Internal server error',      
          error: err.message,      
      });      
    }
  },


  
};
