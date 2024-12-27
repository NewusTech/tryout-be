const { response } = require("../helpers/response.formatter");
const { Evaluation } = require("../models");
const Validator = require("fastest-validator");
const v = new Validator();
const { Op, Sequelize } = require("sequelize");
const { generatePagination } = require("../pagination/pagination");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  useAccelerateEndpoint: true,
});

module.exports = {
  //membuat evaluation mentoring
  createEvaluation: async (req, res) => {
    try {
      const userinfo_id = req.params.userinfo_id;

      const schema = {
        note: { type: "string", min: 3 },
        tanggal: { type: "string" },
        updatedBy: { type: "string" },
      };

      // buat object evaluation
      let EvaluationCreateObj = {
        note: req.body.note,
        userinfo_id: userinfo_id,
        tanggal: req.body.tanggal,
        updatedBy: req.body.updatedBy,
      };

      const validate = v.validate(EvaluationCreateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "validation failed", validate));
        return;
      }

      //buat evaluation
      let EvaluationCreate = await Evaluation.create(EvaluationCreateObj);

      res
        .status(201)
        .json(response(201, "success create evaluation", EvaluationCreate));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //mendapatkan semua data evaluation mentoring
  getEvaluation: async (req, res) => {
    try {
      //get userinfo_id dari req.params
      const { userinfo_id } = req.params;

      const { search } = req.query;

      //create where clause berdasarkan userinfo_id dan pencarian (jika ada)
      const whereClause = {
        userinfo_id: userinfo_id,
      };

      if (search) {
        whereClause[Op.or] = [
          { note: { [Op.like]: `%${search}%` } },
          { tanggal: { [Op.like]: `%${search}%` } },
          { updatedBy: { [Op.like]: `%${search}%` } }
        ];
      }

      let evaluationGet = await Evaluation.findAll({
        where: whereClause,
      });

      //jika evaluation tidak ditemukan
      if (!evaluationGet || evaluationGet.length === 0) {
        return res.status(404).json({
          code: 404,
          message: "Evaluation not found",
          data: [],
        });
      }

      res.status(200).json({
        code: 200,
        message: "Success get evaluation",
        data: evaluationGet,
      });
    } catch (err) {
      console.error("Error:", err.message);
      res.status(500).json({
        code: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },

  //mendapatkan data evaluation mentoringberdasarkan id
  getEvaluationById: async (req, res) => {
    try {
      //mendapatkan data evaluasi mentoring berdasarkan id
      let evaluationGet = await Evaluation.findOne({
        where: {
          id: req.params.id,
        },
      });

      //cek jika evaluation tidak ada
      if (!evaluationGet) {
        res.status(404).json(response(404, "evaluation not found"));
        return;
      }

      //response menggunakan helper response.formatter
      res.status(200).json(response(200, "success get evaluation by id", evaluationGet));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //mengupdate evaluation berdasarkan id
  updateEvaluation: async (req, res) => {
    try {
      // Mendapatkan data evalution untuk pengecekan
      let EvaluationGet = await Evaluation.findOne({
        where: {
          id: req.params.id,
        },
      });

      // Cek apakah data why us ada
      if (!EvaluationGet) {
        res.status(404).json(response(404, "Evaluation not found"));
        return;
      }

      // Membuat schema untuk validasi
      const schema = {
        note: { type: "string", optional: true },
        tanggal: { type: "string", optional: true },
        updatedBy: { type: "string", optional: true },
      };

      let EvaluationUpdateObj = {
        note: req.body.note,
        tanggal: req.body.tanggal,
        updatedBy: req.body.updatedBy,
      };

      // Validasi menggunakan module fastest-validator
      const validate = v.validate(EvaluationUpdateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "validation failed", validate));
        return;
      }

      // Update evaluation
      await Evaluation.update(EvaluationUpdateObj, {
        where: { id: req.params.id },
      });

      // Mendapatkan data evaluation setelah update
      let EvaluationAfterUpdate = await Evaluation.findOne({
        where: { id: req.params.id },
      });

      res.status(200).json(response(200, "success update evaluation", EvaluationAfterUpdate)
        );
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //mendapatkan user data evaluation mentoring
  getUserEvaluation: async (req, res) => {
    try {
      const userinfo_id = req.user.role === "User" ? req.user.userId : null;
      const WhereClause = {};

      // get where clause untuk filter data berdasarkan userinfo_id
      if (userinfo_id) {
        WhereClause.userinfo_id = userinfo_id;
      }
      // get semua data evaluation berdasarkan user yang login
      let evaluationGet = await Evaluation.findAll({
        where: WhereClause,
      });

      // jika tidak ada data ditemukan
      if (!evaluationGet || evaluationGet.length === 0) {
        return res.status(404).json({
          code: 404,
          message: "Evaluation not found",
          data: [],
        });
      }

      res.status(200).json({
        code: 200,
        message: "Success get evaluation",
        data: evaluationGet,
      });
    } catch (err) {
      console.error("Error:", err.message);
      res.status(500).json({
        code: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },
  
};
