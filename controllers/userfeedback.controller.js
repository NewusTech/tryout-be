const { response } = require("../helpers/response.formatter");

const { User_feedback, Package_tryout, Type_package, User_info, sequelize} = require("../models");

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const moment = require("moment-timezone");
const puppeteer = require("puppeteer");
const { generatePagination } = require("../pagination/pagination");

module.exports = {
  
  //input feedback user
  createFeedback: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const idpackage = req.params.idpackage;
      const iduser = req.user.userId;
  
      // Pastikan ID user ada
      if (!iduser) {
        throw new Error("User ID is required");
      }
  
      const { datainput } = req.body;
  
      // Cek apakah package id valid
      let dataPackage = await Package_tryout.findOne({
        where: { id: idpackage },
        include: [
          {
            model: Type_package,
            attributes: ["id", "name"],
          },
        ],
        attributes: ["id"],
      });
  
      // Jika package tidak ditemukan
      if (!dataPackage) {
        throw new Error("Package not found");
      }
  
      // Cek apakah user sudah pernah memberikan feedback untuk package ini
      const feedbackExists = await User_feedback.findOne({
        where: {
          packagetryout_id: idpackage,
          userinfo_id: iduser,
        },
      });
  
      // Jika user sudah memberikan feedback, berikan respons bahwa feedback sudah ada
      if (feedbackExists) {
        return res.status(400).json(response(400, "User sudah input survey"));
      }
  
      let packageID = {
        userinfo_id: Number(iduser),
        packagetryout_id: Number(idpackage),
        question_1: req.body.question_1 ?? null,
        feedback: req.body.feedback ?? null,
      };
  
      // Membuat feedback baru
      const createdFeedback = await User_feedback.create(packageID, {
        transaction,
      });
  
      await transaction.commit();
      res.status(201).json(response(201, "Success create feedback", createdFeedback));
    } catch (err) {
      await transaction.rollback();
      res.status(500).json(response(500, "Internal server error", err));
      console.error(err);
    }
  },
  
  // get all history feedback
  getAllUserFeedbackHistory: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
  
      // Ambil semua feedback terkait dengan user
      const [history, totalCount] = await Promise.all([
        User_feedback.findAll({
          include: [
            {
              model: Package_tryout,
              attributes: ["id", "title"],
            },
            {
              model: User_info,
              attributes: ["id", "name"],
            },
          ],
          limit: limit,
          offset: offset,
          order: [["id", "DESC"]],
        }),
        User_feedback.count({
        }),
      ]);
  
      // Fungsi untuk menghitung total nilai dari feedback dan mengonversi ke skala 100
      const calculateTotalFeedbackAndNilai = (feedbacks) => {
        const totalFeedback = feedbacks.length;
  
        const totalNilai = feedbacks.reduce((sum, feedback) => {
          const nilaiTotal =
            feedback.question_1 * 25;
  
          return sum + nilaiTotal;
        }, 0);
  
        const nilaiRataRata = totalFeedback > 0 ? totalNilai / (totalFeedback * 1) : 0; // Dibagi dengan 4 pertanyaan
        return {
          totalFeedback,
          nilaiRataRata,
        };
      };
  
      // Format data untuk setiap feedback yang didapatkan
      let formattedData = history.map((data) => {
        const feedbackSummary = calculateTotalFeedbackAndNilai([data]);
  
        return {
          id: data.id,
          name: data.User_info ? data.User_info.name : null,
          package_id: data.Package_tryout ? data.Package_tryout.id : null,
          package_name: data.Package_tryout ? data.Package_tryout.title : null,
          total_feedback: feedbackSummary.totalFeedback,
          nila_feedback: feedbackSummary.nilaiRataRata, // Nilai rata-rata di skala 100
          created_at: data.createdAt,
        };
      });
  
      // Generate pagination
      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        `/api/user/history/feedback`
      );
  
      res.status(200).json({
        status: 200,
        message: "Success get all feedback history",
        data: formattedData,
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: err,
      });
      console.log(err);
    }
  },
  
  // get history feedback by package
  getHistoryByPackage: async (req, res) => {
    try {
      const idpackage = Number(req.params.idpackage);
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const year = req.query.year ? parseInt(req.query.year) : null;
      const month = req.query.month ? parseInt(req.query.month) : null;
      const offset = (page - 1) * limit;
      const start_date = req.query.start_date;
      const end_date = req.query.end_date;

      let package;
      let history;
      let totalCount;

      const WhereClause = {};

      // Filter berdasarkan idpackage
      if (idpackage) {
        WhereClause.packagetryout_id = idpackage;
      }

      // Filter berdasarkan tanggal (start_date dan end_date)
      if (start_date && end_date) {
        WhereClause.createdAt = {
          [Op.between]: [
            moment(start_date).startOf("day").toDate(),
            moment(end_date).endOf("day").toDate(),
          ],
        };
      } else if (start_date) {
        WhereClause.createdAt = {
          [Op.gte]: moment(start_date).startOf("day").toDate(),
        };
      } else if (end_date) {
        WhereClause.createdAt = {
          [Op.lte]: moment(end_date).endOf("day").toDate(),
        };
      }

      if (year && month) {
        WhereClause.createdAt = {
          [Op.between]: [
            new Date(year, month - 1, 1),
            new Date(year, month, 0, 23, 59, 59, 999),
          ],
        };
      } else if (year) {
        WhereClause.createdAt = {
          [Op.between]: [
            new Date(year, 0, 1),
            new Date(year, 11, 31, 23, 59, 59, 999),
          ],
        };
      } else if (month) {
        const currentYear = new Date().getFullYear();
        WhereClause.createdAt = {
          [Op.and]: [
            { [Op.gte]: new Date(currentYear, month - 1, 1) },
            { [Op.lte]: new Date(currentYear, month, 0, 23, 59, 59, 999) },
          ],
        };
      }

      // Query untuk mendapatkan data package, history, dan jumlah total data
      [package, history, totalCount] = await Promise.all([
        Package_tryout.findOne({
          where: {
            id: idpackage,
          },
          attributes: ["id", "title"],
        }),
        User_feedback.findAll({
          include: [
            {
              model: User_info,
              attributes: ["id", "name", "asal_instansi", "gender"],
            },
          ],
          where: WhereClause,
          limit: limit,
          offset: offset,
        }),
        User_feedback.count({
          where: WhereClause,
        }),
      ]);

      // Fungsi untuk menghitung nilai per user berdasarkan feedback
      const calculateTotalNilai = (feedback) => {
        const nilaiPerUser =
          feedback.question_1 * 25;

        return nilaiPerUser;
      };

      // Format data yang akan ditampilkan
      let formattedData = history.map((data) => {
        const totalNilai = calculateTotalNilai(data);

        return {
          id: data.id,
          name: data.User_info ? data.User_info.name : null,
          asal_instansi: data.User_info ? data.User_info.asal_instansi : null,
          gender: data.User_info ? data.User_info.gender : null,
          kritiksaran: data.feedback,
          nilai: totalNilai, // Nilai rata-rata per user
          date: data.createdAt,
        };
      });

      // Menghitung nilai rata-rata keseluruhan untuk package tersebut
      const totalNilaiKeseluruhan = formattedData.reduce(
        (sum, item) => sum + item.nilai,
        0
      );
      const rataRataNilaiKeseluruhan =
        totalCount > 0 ? totalNilaiKeseluruhan / totalCount : 0;

      // Generate pagination
      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        `/api/user/history/feedback/${idpackage}`
      );

      // Return hasil
      res.status(200).json({
        status: 200,
        message: "Success get data",
        data: formattedData,
        package: package,
        rataRataNilaiKeseluruhan: rataRataNilaiKeseluruhan.toFixed(2), // Rata-rata keseluruhan dari semua user
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: err,
      });
      console.log(err);
    }
  },

  // user get feedback by id nya
  getDetailHistoryFeedback: async (req, res) => {
    try {
      const idfeedback = req.params.idfeedback;

      // Cari feedback berdasarkan id
      const feedbackData = await User_feedback.findOne({
        where: {
          id: idfeedback,
        },
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
      });

      if (!feedbackData) {
        return res.status(404).json(response(404, "Data not found"));
      }

      // Ambil detail feedback, layanan, dan bidang
      const question_1 = feedbackData.question_1;
      const feedback = feedbackData.feedback;
      const package_name = feedbackData.Package_tryout?.title;
      const type_package_name = feedbackData.Package_tryout?.Type_package?.name;
      const date = feedbackData.createdAt;

      // Jika diperlukan lebih dari satu data, modifikasi di sini
      const formatteddata = {
        id: feedbackData.id,
        question_1,
        feedback,
        package_name: package_name || "Unknown",
        type_package_name: type_package_name || "Unknown",
        date,
      };

      res.status(200).json(response(200, "Success get data feedback", formatteddata));
    } catch (err) {
      console.error(err);
      res.status(500).json(response(500, "Internal server error", err));
    }
  },

};
