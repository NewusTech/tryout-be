const { response } = require("../helpers/response.formatter");

const {
  Package_tryout,
  Question_form,
  Question_form_input,
  Question_form_num,
  Bank_soal,
  Bank_package,
  Type_question,
  sequelize,
} = require("../models");
require("dotenv").config();
const { generatePagination } = require("../pagination/pagination");
const { Op, Sequelize } = require("sequelize");
const Validator = require("fastest-validator");
const v = new Validator();
const ExcelJS = require('exceljs');
const xlsx = require("xlsx");

module.exports = {
  // QUESTION BANK

  //membuat question form multi
  createMultiQuestionForm: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      // Validasi request body
      const schema = {
        field: { type: "string", min: 1 },
        tipedata: { type: "string", min: 1 },
        status: { type: "boolean", optional: true },
        typequestion_id: { type: "number", optional: true },
        correct_answer: { type: "any" },
        discussion: { type: "string", min: 1 },
        datajson: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              key: { type: "string" },
            },
            required: ["id", "key"],
          },
          optional: true,
        },
      };

      // Pastikan request body berupa array
      if (!req.body || !Array.isArray(req.body.questions)) {
        res.status(400).json({
          status: 400,
          message: "Request body must contain an array of questions",
        });
        return;
      }

      console.log(req.body);

      // Validasi input data
      let errors = [];
      let createdBankSoal = null;
      let createdQuestions = [];

      // Langkah 1: Create Bank_soal terlebih dahulu
      const bankSoalData = req.body.banksoal;
      const bankSoalCreate = await Bank_soal.create(
        {
          title: bankSoalData.title,
          typequestion_id: bankSoalData.typequestion_id,
        },
        { transaction }
      );

      createdBankSoal = bankSoalCreate; // Simpan Bank_soal yang sudah dibuat

      // Langkah 2: Loop untuk membuat setiap Question_form
      for (let input of req.body.questions) {
        let correctAnswerProcessed = null;

        // Proses correct_answer
        if (Array.isArray(input.correct_answer)) {
          // Jika correct_answer adalah array, kita bisa mengirim array yang lebih kompleks (ID dan Point)
          correctAnswerProcessed = input.correct_answer.map((answer) => ({
            id: answer.id,
            key: answer.key,
            point: answer.point || 0, // Tambahkan point dengan nilai default 0 jika tidak ada
          }));
        } else if (typeof input.correct_answer === "number") {
          // Jika correct_answer adalah number, kita anggap sebagai ID yang benar
          correctAnswerProcessed = input.correct_answer;
        } else {
          errors.push({
            input,
            errors: ["Invalid format for correct_answer."],
          });
          continue;
        }

        // Objek yang akan digunakan untuk create Question_form
        const questionFormCreateObj = {
          field: input.field,
          tipedata: input.tipedata,
          status: input.status !== undefined ? Boolean(input.status) : true,
          correct_answer: correctAnswerProcessed,
          discussion: input.discussion,
          datajson: input.datajson || null,
          banksoal_id: createdBankSoal.id, // Mengaitkan soal dengan banksoal yang baru dibuat
        };

        // Validasi data sebelum disimpan
        const validate = v.validate(questionFormCreateObj, schema);
        if (validate.length > 0) {
          errors.push({ input, errors: validate });
          continue;
        }

        // Create Question_form
        const questionFormCreate = await Question_form.create(
          questionFormCreateObj,
          { transaction }
        );
        createdQuestions.push(questionFormCreate);
      }

      // Jika ada error pada validasi, rollback transaksi
      if (errors.length > 0) {
        await transaction.rollback();
        res
          .status(400)
          .json({ status: 400, message: "Validation failed", errors });
        return;
      }

      // Commit transaksi jika semuanya berhasil
      await transaction.commit();

      // Kembalikan response sukses
      res.status(201).json({
        status: 201,
        message: "Successfully created bank soal and question forms",
        data: {
          bankSoal: createdBankSoal,
          questionForms: createdQuestions,
        },
      });
    } catch (err) {
      // Rollback transaksi jika terjadi error
      await transaction.rollback();
      console.error(err);
      res
        .status(500)
        .json({
          status: 500,
          message: "Internal server error",
          error: err.message,
        });
    }
  },

  //mendapatkan bank soal by package
  getFormByPackage: async (req, res) => {
    const { packagetryout_id } = req.params;
    const userinfo_id = req.user.role === "User" ? req.user.userId : null;

    try {
        if (!userinfo_id) {
            return res.status(403).json({
                code: 403,
                message: 'Forbidden: Only users can access this resource',
                data: null,
            });
        }

        // Cek sesi aktif
        const latestSession = await Question_form_num.findOne({
            where: { userinfo_id, packagetryout_id },
            order: [['attempt', 'DESC']],
            attributes: ['id', 'start_time', 'end_time', 'status', 'attempt'],
        });

        const now = new Date();

        if (!latestSession || now > new Date(latestSession.end_time)) {
            return res.status(403).json({
                code: 403,
                message: 'No active session. Please start the tryout.',
            });
        }

        // Ambil data Package_tryout
        const data = await Package_tryout.findOne({
            where: { id: packagetryout_id },
            attributes: ['id', 'title', 'slug'],
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
                                    attributes: ['name'],
                                },
                                {
                                    model: Question_form,
                                    attributes: ['id', 'field', 'tipedata', 'datajson'],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        if (!data) {
            return res.status(404).json({
                code: 404,
                message: 'Package tryout not found',
                data: null,
            });
        }

        // Ambil jawaban pengguna untuk sesi aktif
        const questionUser = await Question_form_input.findAll({
            where: { questionformnum_id: latestSession.id },
            attributes: ['data', 'questionform_id'],
        });

        let total_filled = 0;
        let total_unfilled = 0;

        // Gabungkan data soal dengan jawaban pengguna
        const response = {
            code: 200,
            message: 'Success get question form with user answers',
            data: {
              id: data.id,
              title: data.title,
              slug: data.slug,
              attempt: latestSession.attempt, // Nomor percobaan sesi
              start_time: latestSession.start_time,
              end_time: latestSession.end_time,
              Question_forms: data.Bank_packages.flatMap((bankPackage) => 
                  bankPackage.Bank_soal.Question_forms
                      .sort((a, b) => a.id - b.id)
                      .map((questionForm) => {
                          const userAnswer = questionUser.find(
                              (answer) => answer.questionform_id === questionForm.id
                          );
                          const isAnswered = userAnswer ? true : false;
      
                          if (isAnswered) {
                              total_filled++;
                          } else {
                              total_unfilled++;
                          }
      
                          return {
                              id: questionForm.id,
                              type_question_id: bankPackage.Bank_soal.typequestion_id, 
                              type_question_name: bankPackage.Bank_soal.Type_question.name,
                              bank_soal_id: bankPackage.Bank_soal.id,
                              bank_soal_name: bankPackage.Bank_soal.title,
                              field: questionForm.field,
                              tipedata: questionForm.tipedata,
                              datajson: questionForm.datajson,
                              answer: userAnswer ? userAnswer.data : null,
                          };
                      })
              ),
              status: {
                  total_filled,
                  total_unfilled,
              },
          },
      };

        return res.status(200).json(response);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message,
        });
    }
  },

  //mendapatkan semua data question form
  getQuestionForm: async (req, res) => {
    try {
      //mendapatkan data semua question form
      let questionformGets = await Question_form.findAll({
        where: {
          status: true,
        },
        attributes: [
          "id",
          "field",
          "tipedata",
          "datajson",
          "banksoal_id",
          "status",
          "correct_answer",
          "discussion",
          "createdAt",
          "updatedAt",
        ], // Hapus packagetryout_id
      });

      //response menggunakan helper response.formatter
      res
        .status(200)
        .json(response(200, "success get question form", questionformGets));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //mendapatkan data questionform berdasarkan id
  getQuestionFormById: async (req, res) => {
    try {
      //mendapatkan data question form berdasarkan id
      let questionformGet = await Question_form.findOne({
        where: {
          id: req.params.id,
          status: true,
        },
        attributes: [
          "id",
          "field",
          "tipedata",
          "datajson",
          "banksoal_id",
          "status",
          "correct_answer",
          "discussion",
          "createdAt",
          "updatedAt",
        ],
      });

      if (req.user.role !== "Super Admin") {
        return res.status(403).send("Unauthorized: Insufficient role");
      }

      //cek jika question form tidak ada
      if (!questionformGet) {
        res.status(404).json(response(404, "question form not found"));
        return;
      }

      //response menggunakan helper response.formatter
      res
        .status(200)
        .json(
          response(200, "success get question form by id", questionformGet)
        );
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //mengupdate questionform berdasarkan id
  updateQuestionForm: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      // Mendapatkan data questionform untuk pengecekan
      let questionformGet = await Question_form.findOne({
        where: {
          id: req.params.id,
        },
      });

      // Cek apakah data questionform ada
      if (!questionformGet) {
        await transaction.rollback();
        return res.status(404).json(response(404, "questionform not found"));
      }

      await Question_form.update(
        { status: 0 },
        {
          where: {
            id: req.params.id,
          },
          transaction,
        }
      );

      // Membuat schema untuk validasi
      const schema = {
        field: {
          type: "string",
          min: 1,
          optional: true,
        },
        tipedata: {
          type: "string",
          min: 1,
          optional: true,
        },
        status: {
          type: "boolean",
          optional: true,
        },
        correct_answer: {
          type: "string",
          min: 1,
          optional: true,
        },
        discussion: {
          type: "string",
          min: 1,
          optional: true,
        },
        package_tryout_id: {
          type: "number",
          optional: true,
        },
        type_question_id: {
          type: "number",
          optional: true,
        },
        datajson: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              key: { type: "string" },
            },
            required: ["id", "key"],
          },
          optional: true,
        },
      };

      // Buat object questionform baru
      let questionformCreateObj = {
        field: req.body.field,
        tipedata: req.body.tipedata,
        status: true,
        package_tryout_id:
          req.body.package_tryout_id !== undefined
            ? Number(req.body.package_tryout_id)
            : questionformGet.package_tryout_id,
        type_question_id:
          req.body.type_question_id !== undefined
            ? Number(req.body.type_question_id)
            : questionformGet.package_tryout_id,
        datajson: req.body.datajson || null,
        correct_answer: req.body.correct_answer,
        discussion: req.body.discussion,
      };

      const validate = v.validate(questionformCreateObj, schema);
      if (validate.length > 0) {
        await transaction.rollback();
        return res
          .status(400)
          .json(response(400, "validation failed", validate));
      }

      // Membuat form baru di database
      let questionformCreate = await Question_form.create(
        questionformCreateObj,
        { transaction }
      );

      await transaction.commit();

      // Mendapatkan data questionform baru yang dibuat
      let questionformAfterCreate = await Question_form.findOne({
        where: {
          id: questionformCreate.id,
        },
      });

      return res
        .status(200)
        .json(
          response(
            200,
            "success update and create new questionform",
            questionformAfterCreate
          )
        );
    } catch (err) {
      await transaction.rollback();
      return res.status(500).json(response(500, "internal server error", err));
    }
  },

  //mengupdate question form
  updateMultiQuestionForm: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const schema = {
        id: { type: "number", min: 1, optional: true },
        field: { type: "string", min: 1 },
        tipedata: { type: "string", min: 1, optional: true },
        correct_answer: { type: "string", min: 1 },
        discussion: { type: "string", min: 1, optional: true },
        status: { type: "boolean", optional: true },
        datajson: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              key: { type: "string" },
            },
            required: ["id", "key"],
          },
          optional: true,
        },
      };

      // Ambil layanan_id dari URL parameter
      // const layanan_id = req.params.layananid;
      // if (!layanan_id) {
      //     return res.status(400).json(response(400, 'layanan_id URL param is required'));
      // }

      // Check if the request body is an array
      if (!Array.isArray(req.body)) {
        return res
          .status(400)
          .json(response(400, "Request body must be an array of objects"));
      }

      // Initialize arrays for validation errors and successfully updated objects
      let errors = [];
      let updatedForms = [];
      let createdForms = [];

      // Validate and process each object in the input array
      for (let input of req.body) {
        // Check if the questionform exists
        let questionformGet = await Question_form.findOne({
          where: {
            id: input.id,
          },
        });

        if (!questionformGet) {
          errors.push({ input, errors: ["question form not found"] });
          continue;
        }

        // Update the status of the existing form to 0
        await Question_form.update(
          { status: 0 }, // Update status to 0
          { where: { id: input.id }, transaction }
        );

        // Create the new question form object for insertion
        let questionformCreateObj = {
          field: input.field,
          tipedata: input.tipedata,
          correct_answer: input.correct_answer,
          discussion: input.discussion,
          status: input.status !== undefined ? Boolean(input.status) : true,
          package_tryout_id:
            req.body.package_tryout_id !== undefined
              ? Number(req.body.package_tryout_id)
              : questionformGet.package_tryout_id,
          type_question_id:
            req.body.type_question_id !== undefined
              ? Number(req.body.type_question_id)
              : questionformGet.type_question_id,
          datajson: input.datajson || null,
        };

        // Validate the new object
        const validate = v.validate(questionformCreateObj, schema);
        if (validate.length > 0) {
          errors.push({ input, errors: validate });
          continue;
        }

        // Create new question form in the database
        let questionformCreate = await Question_form.create(
          questionformCreateObj,
          { transaction }
        );
        createdForms.push(questionformCreate);
      }

      // If there are validation errors, respond with them
      if (errors.length > 0) {
        await transaction.rollback();
        return res.status(400).json(response(400, "Validation failed", errors));
      }

      // Commit transaction if everything is fine
      await transaction.commit();
      return res
        .status(200)
        .json(
          response(
            200,
            "Successfully updated and created new question form(s)",
            { createdForms }
          )
        );
    } catch (err) {
      await transaction.rollback();
      console.log(err);
      return res.status(500).json(response(500, "Internal server error", err));
    }
  },

  //menghapus question form berdasarkan id
  deleteQuestionForm: async (req, res) => {
    try {
      let questionformGet = await Question_form.findOne({
        where: {
          id: req.params.id,
        },
      });

      // Cek apakah data question form ada
      if (!questionformGet) {
        res.status(404).json(response(404, "question form not found"));
        return;
      }

      await Question_form.update(
        { status: false },
        {
          where: { id: req.params.id },
        }
      );

      // Response sukses
      res.status(200).json(response(200, "Success delete question form"));
    } catch (err) {
      if (err.name === "SequelizeForeignKeyConstraintError") {
        res
          .status(400)
          .json(
            response(
              400,
              "Data tidak bisa diubah karena masih digunakan pada tabel lain"
            )
          );
      } else {
        res.status(500).json(response(500, "Internal server error", err));
        console.log(err);
      }
    }
  },

  //mendapatkan data bank soal
  getBankSoal: async (req, res) => {
    try {
      const search = req.query.search ?? null;
      const banksoal_id = req.query.banksoal_id ?? null;
      const month = parseInt(req.query.month) || null;
      const year = parseInt(req.query.year) || null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
  
      const whereCondition = {};
  
      if (banksoal_id) {
        whereCondition.id = banksoal_id;
      }
  
      if (search) {
        whereCondition[Op.or] = [
          {
            title: { [Op.like]: `%${search}%` },
          },
        ];
      }
  
      // Filter berdasarkan bulan dan tahun (berdasarkan createdAt)
      if (month && year) {
        whereCondition.createdAt = {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("MONTH", Sequelize.col("Bank_soal.createdAt")),
              month
            ),
            Sequelize.where(
              Sequelize.fn("YEAR", Sequelize.col("Bank_soal.createdAt")),
              year
            ),
          ],
        };
      } else if (year) {
        whereCondition.createdAt = Sequelize.where(
          Sequelize.fn("YEAR", Sequelize.col("Bank_soal.createdAt")),
          year
        );
      }
  
      // Ambil data bank soal
      const [packageGets, totalCount] = await Promise.all([
        Bank_soal.findAll({
          where: whereCondition,
          include: [
            {
              model: Type_question,
              attributes: ["id", "name"],
            },
          ],
          limit: limit,
          offset: offset,
          order: [["id", "ASC"]],
        }),
        Bank_soal.count({
          where: whereCondition,
        }),
      ]);
  
      // Ambil total soal berdasarkan banksoal_id
      const banksoalIds = packageGets.map((pkg) => pkg.id);
  
      const questionCounts = await Question_form.findAll({
        attributes: [
          "banksoal_id",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "total_soal"],
        ],
        where: {
          banksoal_id: {
            [Op.in]: banksoalIds,
          },
        },
        group: ["banksoal_id"],
      });
  
      // Map jumlah soal berdasarkan banksoal_id
      const questionCountMap = questionCounts.reduce((map, item) => {
        map[item.banksoal_id] = parseInt(item.dataValues.total_soal, 10);
        return map;
      }, {});
  
      const modifiedPackageGets = packageGets.map((package) => {
        const { Type_question, ...otherData } = package.dataValues;
        return {
          ...otherData,
          Type_question_name: Type_question?.name,
          Total_question: questionCountMap[package.id] || 0,
        };
      });
  
      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        "/api/user/bank/question/get"
      );
  
      res.status(200).json({
        status: 200, 
        message: "success get bank soal",
        data: modifiedPackageGets,
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: "internal server error",
        error: err.message,
      });
      console.log(err);
      logger.error(`Error : ${err}`);
      logger.error(`Error message: ${err.message}`);
    }
  },

  //mendapatkan data bank soal berdasarkan kategori
  getBankSoalByType: async (req, res) => {
    try {
      const typequestion_id = parseInt(req.params.typequestion_id) || null;
      const search = req.query.search ?? null;
      const month = parseInt(req.query.month) || null;
      const year = parseInt(req.query.year) || null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
  
      if (!typequestion_id) {
        return res.status(400).json({
          status: 400,
          message: "type_question_id is required",
        });
      }
  
      const whereCondition = {
        typequestion_id: typequestion_id,
      };
  
      if (search) {
        whereCondition[Op.or] = [
          {
            title: { [Op.like]: `%${search}%` },
          },
        ];
      }
  
      // Filter berdasarkan bulan dan tahun (berdasarkan createdAt)
      if (month && year) {
        whereCondition.createdAt = {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("MONTH", Sequelize.col("Bank_soal.createdAt")),
              month
            ),
            Sequelize.where(
              Sequelize.fn("YEAR", Sequelize.col("Bank_soal.createdAt")),
              year
            ),
          ],
        };
      } else if (year) {
        whereCondition.createdAt = Sequelize.where(
          Sequelize.fn("YEAR", Sequelize.col("Bank_soal.createdAt")),
          year
        );
      }
  
      const [bankSoals, totalCount] = await Promise.all([
        Bank_soal.findAll({
          where: whereCondition,
          include: [
            {
              model: Type_question,
              attributes: ["id", "name"],
            },
          ],
          limit: limit,
          offset: offset,
          order: [["id", "ASC"]],
        }),
        Bank_soal.count({
          where: whereCondition,
        }),
      ]);
  
      const modifiedBankSoals = bankSoals.map((bankSoal) => {
        const { Type_question, ...otherData } = bankSoal.dataValues;
        return {
          ...otherData,
          Type_question_name: Type_question?.name,
        };
      });
  
      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        "/api/user/bank/question/get/:typequestion_id"
      );
  
      res.status(200).json({
        status: 200,
        message: "success get bank soal by type question",
        data: modifiedBankSoals,
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: "internal server error",
        error: err.message,
      });
      console.log(err);
      logger.error(`Error : ${err}`);
      logger.error(`Error message: ${err.message}`);
    }
  },

  //mendapatkan detail data soal by id bank soal
  getFormByBankSoal: async (req, res) => {
    const { banksoal_id } = req.params;

    try {
        // Ambil data Bank_soal
        const data = await Bank_soal.findOne({
            where: { id: banksoal_id },
            attributes: ['id', 'title', 'typequestion_id'],
            include: [
                {
                    model: Type_question,
                    attributes: ['name'],
                },
                {
                    model: Question_form,
                    attributes: ['id', 'field', 'tipedata', 'datajson', 'discussion', 'correct_answer'],
                },
            ],
        });

        // Jika bank soal tidak ditemukan
        if (!data) {
            return res.status(404).json({
                code: 404,
                message: 'Bank soal not found',
                data: null,
            });
        }

        // Gabungkan data soal
        const response = {
            code: 200,
            message: 'Success get question form by banksoal_id',
            data: {
                id: data.id,
                title: data.title,
                typequestion_id: data.typequestion_id,
                Type_question: data.Type_question,
                Question_forms: data.Question_forms.map((questionForm) => {
                    return {
                        id: questionForm.id,
                        field: questionForm.field,
                        tipedata: questionForm.tipedata,
                        datajson: questionForm.datajson,
                        correct_answer: questionForm.correct_answer,
                        discussion: questionForm.discussion,
                    };
                }),
            },
        };
        
        return res.status(200).json(response);
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          code: 500,
          message: 'Internal server error',
          error: error.message,
        });
      }
  },

  //import data bank soal ke sistem
  importBankSoal: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 400,
                message: "No file uploaded. Please upload an Excel file.",
            });
        }

        // Membaca file Excel
        const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0]; // Ambil sheet pertama
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!sheetData || sheetData.length === 0) {
            return res.status(400).json({
                status: 400,
                message: "Excel file is empty or invalid format.",
            });
        }

        const bankSoalTitle = sheetData[0]?.banksoal_title;
        const typeQuestionId = sheetData[0]?.typequestion_id;

        if (!bankSoalTitle || !typeQuestionId) {
            return res.status(400).json({
                status: 400,
                message: "Missing bank soal information in the Excel file.",
            });
        }

        // Buat Bank_soal
        const createdBankSoal = await Bank_soal.create(
            {
                title: bankSoalTitle,
                typequestion_id: typeQuestionId,
            },
            { transaction }
        );

        let createdQuestions = [];
        let errors = [];

        // Proses setiap baris sebagai Question_form
        for (let row of sheetData) {
            try {
                // Parsing correct_answer dan datajson
                const correctAnswer = JSON.parse(row.correct_answer || "[]");
                const datajson = JSON.parse(row.datajson || "[]");

                // Buat Question_form
                const questionForm = await Question_form.create(
                    {
                        field: row.field,
                        tipedata: row.tipedata,
                        status: row.status !== undefined ? Boolean(row.status) : true,
                        correct_answer: correctAnswer,
                        discussion: row.discussion,
                        datajson: datajson,
                        banksoal_id: createdBankSoal.id, // Hubungkan dengan Bank_soal
                    },
                    { transaction }
                );

                createdQuestions.push(questionForm);
            } catch (error) {
                errors.push({
                    row,
                    error: error.message,
                });
            }
        }
        
        if (errors.length > 0) {
            await transaction.rollback();
            return res.status(400).json({
                status: 400,
                message: "Some rows failed to process",
                errors,
            });
        }

        // Commit transaksi jika semua berhasil
        await transaction.commit();

        return res.status(201).json({
            status: 201,
            message: "Successfully imported bank soal and question forms",
            data: {
                bankSoal: createdBankSoal,
                questionForms: createdQuestions,
            },
        });
    } catch (err) {
        // Rollback transaksi jika terjadi error
        await transaction.rollback();
        console.error(err);
        return res.status(500).json({
            status: 500,
            message: "Internal server error",
            error: err.message,
        });
    }
  },
  
};
