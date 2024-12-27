const { response } = require("../helpers/response.formatter");
const { Program } = require("../models");
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
  
  //membuat program
  createProgram: async (req, res) => {
    try {

      const schema = {
        title: { type: "string" },
        description: { type: "string" },
      };

      // buat object program
      let ProgramCreateObj = {
        title: req.body.title,
        description: req.body.description,
      };

      const validate = v.validate(ProgramCreateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "validation failed", validate));
        return;
      }

      //buat program
      let ProgramCreate = await Program.create(ProgramCreateObj);

      res
        .status(201)
        .json(response(201, "success create program", ProgramCreate));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //mendapatkan semua data program
  getProgram: async (req, res) => {
    try {

      let programGet = await Program.findAll({
      });

      //jika program tidak ditemukan
      if (!programGet || programGet.length === 0) {
        return res.status(404).json({
          code: 404,
          message: "Program not found",
          data: [],
        });
      }

      res.status(200).json({
        code: 200,
        message: "Success get program",
        data: programGet,
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

  //mendapatkan data program berdasarkan id
  getProgramById: async (req, res) => {
    try {
      //mendapatkan data program berdasarkan id
      let programGet = await Program.findOne({
        where: {
          id: req.params.id,
        },
      });

      //cek jika program tidak ada
      if (!programGet) {
        res.status(404).json(response(404, "Program not found"));
        return;
      }

      //response menggunakan helper response.formatter
      res.status(200).json(response(200, "success get program by id", programGet));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //mengupdate program berdasarkan id
  updateProgram: async (req, res) => {
    try {

      let ProgramGet = await Program.findOne({
        where: {
          id: req.params.id,
        },
      });

      // cek apakah data program ada
      if (!ProgramGet) {
        res.status(404).json(response(404, "Program not found"));
        return;
      }

      // schema untuk validasi
      const schema = {
        title: { type: "string", optional: true },
        description: { type: "string", optional: true },
      };

      let ProgramUpdateObj = {
        title: req.body.title,
        description: req.body.description,
      };

      const validate = v.validate(ProgramUpdateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "validation failed", validate));
        return;
      }

      // update program
      await Program.update(ProgramUpdateObj, {
        where: { id: req.params.id },
      });

      // get data program setelah update
      let ProgramAfterUpdate = await Program.findOne({
        where: { id: req.params.id },
      });

      res.status(200).json(response(200, "success update program", ProgramAfterUpdate));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //menghapus program berdasarkan id
  deleteProgram: async (req, res) => {
    try {
        let ProgramGet = await Program.findOne({
            where: {
                id: req.params.id
            }
        })
        if (!ProgramGet) {
            res.status(404).json(response(404, 'Program not found'));
            return;
        }

        await Program.destroy({
            where: {
                id: req.params.id,
            }
        })

        res.status(200).json(response(200, 'success delete program'));

    } catch (err) {
        res.status(500).json(response(500, 'internal server error', err));
        console.log(err);
    }
  }
  
};
