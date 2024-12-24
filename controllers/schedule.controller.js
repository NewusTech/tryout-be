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

      if (!title || !packagetryout_id || !tanggal || !waktu) {
        return res.status(400).json(response(400, "All fields are required"));
      }

      //cek apakah paket_tryout_id ada
      const paketTryout = await Package_tryout.findByPk(packagetryout_id);
      if (!paketTryout) {
        return res.status(404).json(response(404, "Paket tryout not found"));
      }

      //create schedule tryout baru
      const schedule = await Schedule.create({
        title,
        packagetryout_id,
        tanggal,
        waktu,
        isEvent: isEvent ?? 1,
      });

      //update isEvent di tabel Package_tryout
      await paketTryout.update({
        isEvent: 1
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

      //get semua jenis soal (TWK, TIU, TKP) dari database
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
        offset: (page - 1) * limit,
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

          //gett jawaban peserta
          const answers = await Question_form_input.findAll({
            where: { questionformnum_id: participant.id },
          });

          //get semua soal yang tersedia di tryout
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

          //inisialisasi semua tipe soal dengan nilai 0
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

              if (
                typeof correctAnswer === "string" ||
                typeof correctAnswer === "number"
              ) {
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

              questionSummary[typeId].totalQuestions += 1;

              if (userAnswer !== null && userAnswer !== undefined) {
                if (isCorrect) {
                  questionSummary[typeId].totalCorrect += 1;
                  questionSummary[typeId].totalScore += points;
                } else {
                  questionSummary[typeId].totalIncorrect += 1;
                }
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
};
