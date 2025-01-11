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
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
  credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  useAccelerateEndpoint: true
});

module.exports = {
  // QUESTION BANK

  createMultiQuestionForm: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const schema = {
            field: { type: "string", optional: true },
            tipedata: { type: "string", min: 1 },
            status: { type: "boolean", optional: true },
            correct_answer: { type: "any" }, // Validasi dilakukan manual di bawah
            discussion: { type: "string", min: 1 },
            datajson: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "number" },
                        key: { type: "string" }, // URL gambar
                    },
                    required: ["id", "key"],
                },
                optional: true,
            },
        };

        const bankSoalSchema = {
            title: { type: "string", min: 1 },
            typequestion_id: { type: "number", optional: true },
        };

        let banksoal, questions;
        try {
            banksoal = JSON.parse(req.body.banksoal);
            questions = JSON.parse(req.body.questions);
        } catch (parseErr) {
            return res.status(400).json({ status: 400, message: "Invalid JSON format", error: parseErr.message });
        }

        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ status: 400, message: "Request body must contain an array of questions" });
        }

        let errors = [];
        let createdBankSoal = null;
        let createdQuestions = [];

        // Step 1: Create Bank_soal
        const bankSoalValidate = v.validate(banksoal, bankSoalSchema);
        if (bankSoalValidate.length > 0) {
            errors.push({ input: banksoal, errors: bankSoalValidate });
        } else {
            const bankSoalCreate = await Bank_soal.create(
                { title: banksoal.title, typequestion_id: banksoal.typequestion_id },
                { transaction }
            );
            createdBankSoal = bankSoalCreate;
        }

        // Step 2: Process Questions
        for (let input of questions) {
            if (!input.field) {
                errors.push({ input, errors: ["Missing 'field' for question."] });
                continue;
            }

            console.log("Available files: ", req.files.map((file) => file.fieldname));

            let fieldProcessed = input.field; // Default field as string
            const fieldImageFile = req.files.find((f) => f.fieldname === fieldProcessed);

            if (fieldImageFile) {
                try {
                    const uploadParams = {
                        Bucket: process.env.AWS_BUCKET,
                        Key: `${process.env.PATH_AWS}/questions/${new Date().getTime()}-${fieldImageFile.originalname}`,
                        Body: fieldImageFile.buffer,
                        ACL: "public-read",
                        ContentType: fieldImageFile.mimetype,
                    };
                    const command = new PutObjectCommand(uploadParams);
                    await s3Client.send(command);

                    fieldProcessed = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
                } catch (error) {
                    console.error("Failed to upload field image:", error);
                    errors.push({ input, errors: ["Failed to upload field image to AWS."] });
                    continue;
                }
            }

            let discussionProcessed = input.discussion; 
            const discussionImageFile = req.files.find((f) => f.fieldname === discussionProcessed);

            console.log("DISCUSSION: ", discussionImageFile);

            if (discussionImageFile) {
                try {
                    const uploadParams = {
                        Bucket: process.env.AWS_BUCKET,
                        Key: `${process.env.PATH_AWS}/discussions/${new Date().getTime()}-${discussionImageFile.originalname}`,
                        Body: discussionImageFile.buffer,
                        ACL: "public-read",
                        ContentType: discussionImageFile.mimetype,
                    };
                    const command = new PutObjectCommand(uploadParams);
                    await s3Client.send(command);

                    discussionProcessed = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
                } catch (error) {
                    console.error("Failed to upload discussion image:", error);
                    errors.push({ input, errors: ["Failed to upload discussion image to AWS."] });
                    continue;
                }
            }

            let correctAnswerProcessed = null;
            if (Array.isArray(input.correct_answer)) {
                correctAnswerProcessed = input.correct_answer.map((answer) => ({
                    id: answer.id,
                    key: answer.key,
                    point: answer.point || 0,
                }));
            } else if (typeof input.correct_answer === "number") {
                correctAnswerProcessed = input.correct_answer;
            } else {
                errors.push({ input, errors: ["Invalid format for correct_answer."] });
                continue;
            }

            let datajsonProcessed = [];
            // if (input.datajson && Array.isArray(input.datajson)) {
            //     for (let item of input.datajson) {
            //         const file = req.files.find((f) => f.fieldname === `image_${item.id}`);
            //         if (file) {
            //             try {
            //                 const uploadParams = {
            //                     Bucket: process.env.AWS_BUCKET,
            //                     Key: `${process.env.PATH_AWS}/options/${new Date().getTime()}-${file.originalname}`,
            //                     Body: file.buffer,
            //                     ACL: "public-read",
            //                     ContentType: file.mimetype,
            //                 };
            //                 const command = new PutObjectCommand(uploadParams);
            //                 await s3Client.send(command);

            //                 const imageUrl = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            //                 datajsonProcessed.push({ id: item.id, key: imageUrl });
            //             } catch (error) {
            //                 errors.push({ input, errors: [`Failed to upload image for id ${item.id}.`] });
            //                 continue;
            //             }
            //         } else {
            //             datajsonProcessed.push({ id: item.id, key: item.key });
            //         }
            //     }
            // }

            if (input.datajson && Array.isArray(input.datajson)) {
              for (let item of input.datajson) {
                  if (req.files && item.key.startsWith("image_")) {
                      // Jika key adalah "image_X", cari file dengan fieldname yang sesuai
                      const file = req.files.find((f) => f.fieldname === item.key);
                      if (file) {
                          try {
                              const uploadParams = {
                                  Bucket: process.env.AWS_BUCKET,
                                  Key: `${process.env.PATH_AWS}/options/${new Date().getTime()}-${file.originalname}`,
                                  Body: file.buffer,
                                  ACL: "public-read",
                                  ContentType: file.mimetype,
                              };
                              const command = new PutObjectCommand(uploadParams);
                              await s3Client.send(command);
          
                              const imageUrl = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
                              datajsonProcessed.push({ id: item.id, key: imageUrl });
                          } catch (error) {
                              errors.push({ input, errors: [`Failed to upload image for id ${item.id}.`] });
                              continue;
                          }
                      } else {
                          // Jika file tidak ditemukan, tambahkan error
                          errors.push({ input, errors: [`File not found for key: ${item.key}.`] });
                          continue;
                      }
                  } else {
                      // Jika key adalah string biasa, gunakan langsung
                      datajsonProcessed.push({ id: item.id, key: item.key });
                  }
              }
          }

            const questionFormCreateObj = {
              field: fieldProcessed,
              tipedata: input.tipedata,
              status: input.status !== undefined ? Boolean(input.status) : true,
              correct_answer: correctAnswerProcessed,
              discussion: discussionProcessed, // Gunakan hasil proses discussion
              datajson: datajsonProcessed,
              banksoal_id: createdBankSoal.id,
          };

            const validate = v.validate(questionFormCreateObj, schema);
            if (validate.length > 0) {
                errors.push({ input, errors: validate });
                continue;
            }

            const questionFormCreate = await Question_form.create(questionFormCreateObj, { transaction });
            createdQuestions.push(questionFormCreate);
        }

        if (errors.length > 0) {
            await transaction.rollback();
            return res.status(400).json({ status: 400, message: "Validation failed", errors });
        }

        await transaction.commit();
        res.status(201).json({
            status: 201,
            message: "Successfully created bank soal and question forms",
            data: { bankSoal: createdBankSoal, questionForms: createdQuestions },
        });
    } catch (err) {
        await transaction.rollback();
        console.error(err);
        res.status(500).json({ status: 500, message: "Internal server error", error: err.message });
    }
  },

  //mendapatkan bank soal by package
  // getFormByPackage: async (req, res) => {
  //   const { packagetryout_id } = req.params;
  //   const userinfo_id = req.user.role === "User" ? req.user.userId : null;

  //   try {
  //     if (!userinfo_id) {
  //       return res.status(403).json({
  //         code: 403,
  //         message: "Forbidden: Only users can access this resource",
  //         data: null,
  //       });
  //     }

  //     // Cek sesi aktif
  //     const latestSession = await Question_form_num.findOne({
  //       where: { userinfo_id, packagetryout_id },
  //       order: [["attempt", "DESC"]],
  //       attributes: ["id", "start_time", "end_time", "status", "attempt"],
  //     });

  //     const now = new Date();

  //     if (!latestSession || now > new Date(latestSession.end_time)) {
  //       return res.status(403).json({
  //         code: 403,
  //         message: "No active session. Please start the tryout.",
  //       });
  //     }

  //     // Ambil data Package_tryout
  //     const data = await Package_tryout.findOne({
  //       where: { id: packagetryout_id },
  //       attributes: ["id", "title", "slug"],
  //       include: [
  //         {
  //           model: Bank_package,
  //           attributes: ["id", "packagetryout_id", "banksoal_id"],
  //           include: [
  //             {
  //               model: Bank_soal,
  //               attributes: ["id", "title", "typequestion_id"],
  //               include: [
  //                 {
  //                   model: Type_question,
  //                   attributes: ["name"],
  //                 },
  //                 {
  //                   model: Question_form,
  //                   attributes: ["id", "field", "tipedata", "datajson"],
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       ],
  //     });

  //     if (!data) {
  //       return res.status(404).json({
  //         code: 404,
  //         message: "Package tryout not found",
  //         data: null,
  //       });
  //     }

  //     // Ambil jawaban pengguna untuk sesi aktif
  //     const questionUser = await Question_form_input.findAll({
  //       where: { questionformnum_id: latestSession.id },
  //       attributes: ["data", "questionform_id"],
  //     });

  //     let total_filled = 0;
  //     let total_unfilled = 0;

  //     // Gabungkan data soal dengan jawaban pengguna
  //     const response = {
  //       code: 200,
  //       message: "Success get question form with user answers",
  //       data: {
  //         id: data.id,
  //         title: data.title,
  //         slug: data.slug,
  //         attempt: latestSession.attempt, // Nomor percobaan sesi
  //         start_time: latestSession.start_time,
  //         end_time: latestSession.end_time,
  //         Question_forms: data.Bank_packages.flatMap((bankPackage) =>
  //           bankPackage.Bank_soal.Question_forms.sort(
  //             (a, b) => a.id - b.id
  //           ).map((questionForm) => {
  //             const userAnswer = questionUser.find(
  //               (answer) => answer.questionform_id === questionForm.id
  //             );
  //             const isAnswered = userAnswer ? true : false;

  //             if (isAnswered) {
  //               total_filled++;
  //             } else {
  //               total_unfilled++;
  //             }

  //             return {
  //               id: questionForm.id,
  //               type_question_id: bankPackage.Bank_soal.typequestion_id,
  //               type_question_name: bankPackage.Bank_soal.Type_question.name,
  //               bank_soal_id: bankPackage.Bank_soal.id,
  //               bank_soal_name: bankPackage.Bank_soal.title,
  //               field: questionForm.field,
  //               tipedata: questionForm.tipedata,
  //               datajson: questionForm.datajson,
  //               answer: userAnswer ? userAnswer.data : null,
  //             };
  //           })
  //         ),
  //         status: {
  //           total_filled,
  //           total_unfilled,
  //         },
  //       },
  //     };

  //     return res.status(200).json(response);
  //   } catch (error) {
  //     console.error(error);

  //     return res.status(500).json({
  //       code: 500,
  //       message: "Internal server error",
  //       error: error.message,
  //     });
  //   }
  // },

  getFormByPackage: async (req, res) => {
    const { packagetryout_id } = req.params;
    const userinfo_id = req.user.role === "User" ? req.user.userId : null;
  
    try {
      if (!userinfo_id) {
        return res.status(403).json({
          code: 403,
          message: "Forbidden: Only users can access this resource",
          data: null,
        });
      }
  
      // Cek sesi aktif
      const latestSession = await Question_form_num.findOne({
        where: { userinfo_id, packagetryout_id },
        order: [["attempt", "DESC"]],
        attributes: ["id", "start_time", "end_time", "status", "attempt"],
      });
  
      const now = new Date();
  
      if (!latestSession || now > new Date(latestSession.end_time)) {
        return res.status(403).json({
          code: 403,
          message: "No active session. Please start the tryout.",
        });
      }
  
      // Ambil data Package_tryout
      const data = await Package_tryout.findOne({
        where: { id: packagetryout_id },
        attributes: ["id", "title", "slug"],
        include: [
          {
            model: Bank_package,
            attributes: ["id", "packagetryout_id", "banksoal_id"],
            include: [
              {
                model: Bank_soal,
                attributes: ["id", "title", "typequestion_id"],
                include: [
                  {
                    model: Type_question,
                    attributes: ["name"],
                  },
                  {
                    model: Question_form,
                    attributes: ["id", "field", "tipedata", "datajson"],
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
          message: "Package tryout not found",
          data: null,
        });
      }
  
      // Ambil jawaban pengguna untuk sesi aktif
      const questionUser = await Question_form_input.findAll({
        where: { questionformnum_id: latestSession.id },
        attributes: ["data", "questionform_id"],
      });
  
      let total_filled = 0;
      let total_unfilled = 0;
  
      // Gabungkan data soal dengan jawaban pengguna
      const Question_forms = data.Bank_packages.flatMap((bankPackage) =>
        bankPackage.Bank_soal.Question_forms.map((questionForm) => {
          const userAnswer = questionUser.find(
            (answer) => answer.questionform_id === questionForm.id
          );
          const isAnswered = !!userAnswer;
  
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
      );
  
      // Urutkan berdasarkan type_question_id terlebih dahulu
      Question_forms.sort((a, b) => a.type_question_id - b.type_question_id);
  
      const response = {
        code: 200,
        message: "Success get question form with user answers",
        data: {
          id: data.id,
          title: data.title,
          slug: data.slug,
          attempt: latestSession.attempt, // Nomor percobaan sesi
          start_time: latestSession.start_time,
          end_time: latestSession.end_time,
          Question_forms,
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
        message: "Internal server error",
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
      // Validasi request body
      if (!req.body || !Array.isArray(req.body.questions)) {
        return res.status(400).json({
          status: 400,
          message: "Request body must contain an array of questions",
        });
      }

      let errors = [];
      let updatedQuestions = [];
      let createdQuestions = [];

      // Loop untuk memproses setiap Question_form
      for (let input of req.body.questions) {
        if (!input.id) {
          errors.push({ input, errors: ["ID is required"] });
          continue;
        }

        // Cek apakah Question_form sudah ada
        const questionForm = await Question_form.findOne({
          where: { id: input.id },
          transaction,
        });

        if (!questionForm) {
          errors.push({ input, errors: ["Question form not found"] });
          continue;
        }

        // Update status question form lama ke 0
        await Question_form.update(
          { status: 0 },
          { where: { id: input.id }, transaction }
        );

        // Proses correct_answer
        let correctAnswerProcessed = null;
        if (Array.isArray(input.correct_answer)) {
          correctAnswerProcessed = input.correct_answer.map((answer) => ({
            id: answer.id,
            key: answer.key,
            point: answer.point || 0, // Default point = 0 jika tidak ada
          }));
        } else if (typeof input.correct_answer === "number") {
          correctAnswerProcessed = input.correct_answer;
        } else {
          errors.push({
            input,
            errors: ["Invalid format for correct_answer."],
          });
          continue;
        }

        // Buat objek untuk membuat question form baru
        const questionFormCreateObj = {
          field: input.field,
          tipedata: input.tipedata,
          status: input.status !== undefined ? Boolean(input.status) : true,
          correct_answer: correctAnswerProcessed,
          discussion: input.discussion,
          datajson: input.datajson || null,
          banksoal_id: questionForm.banksoal_id, // Mengaitkan dengan bank soal yang sama
        };

        // Buat Question_form baru
        const questionFormCreate = await Question_form.create(
          questionFormCreateObj,
          { transaction }
        );
        createdQuestions.push(questionFormCreate);
      }

      // Jika ada error pada validasi, rollback transaksi
      if (errors.length > 0) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ status: 400, message: "Validation failed", errors });
      }

      // Commit transaksi jika semuanya berhasil
      await transaction.commit();

      return res.status(200).json({
        status: 200,
        message: "Successfully updated and created new question forms",
        data: {
          updatedQuestions,
          createdQuestions,
        },
      });
    } catch (err) {
      await transaction.rollback();
      console.error("Error updating question forms:", err);
      return res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },

  //menghapus question form berdasarkan id
  deleteQuestionForm: async (req, res) => {
    try {
      let questionformGet = await Bank_soal.findOne({
        where: {
          id: req.params.id,
        },
      });

      // Cek apakah data question form ada
      if (!questionformGet) {
        res.status(404).json(response(404, "question form not found"));
        return;
      }

      await Bank_soal.destroy({
        where: {
            id: req.params.id,
        }
      });

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
      const typequestion_id = req.query.typequestion_id ?? null;
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
        whereCondition[Op.or] = [{ title: { [Op.like]: `%${search}%` } }];
      }

      //filter by typequestion_id
      if (typequestion_id) {
        whereCondition.typequestion_id = typequestion_id;
      }

      //filter by month and year
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

      //get data bank soal
      const [packageGets, totalCount] = await Promise.all([
        Bank_soal.findAll({
          where: whereCondition,
          include: [
            {
              model: Type_question,
              attributes: ["id", "name"],
              where: typequestion_id ? { id: typequestion_id } : undefined,
            },
          ],
          limit: limit,
          offset: offset,
          order: [["id", "ASC"]],
        }),
        Bank_soal.count({
          where: whereCondition,
          include: [
            {
              model: Type_question,
              where: typequestion_id ? { id: typequestion_id } : undefined,
            },
          ],
        }),
      ]);

      //get total soal berdasarkan banksoal_id
      const banksoalid = packageGets.map((pkg) => pkg.id);

      const questionCounts = await Question_form.findAll({
        attributes: [
          "banksoal_id",
          [Sequelize.fn("COUNT", Sequelize.col("id")), "total_soal"],
        ],
        where: {
          banksoal_id: {
            [Op.in]: banksoalid,
          },
        },
        group: ["banksoal_id"],
      });

      //map jumlah soal berdasarkan banksoal_id
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
        attributes: ["id", "title", "typequestion_id"],
        include: [
          {
            model: Type_question,
            attributes: ["name"],
          },
          {
            model: Question_form,
            attributes: [
              "id",
              "field",
              "tipedata",
              "datajson",
              "discussion",
              "correct_answer",
            ],
          },
        ],
      });

      // Jika bank soal tidak ditemukan
      if (!data) {
        return res.status(404).json({
          code: 404,
          message: "Bank soal not found",
          data: null,
        });
      }

      // Gabungkan data soal
      const response = {
        code: 200,
        message: "Success get question form by banksoal_id",
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
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  //import bank soal
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
      const sheetName = workbook.SheetNames[0]; 
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
      console.log("Sheet Data:", sheetData); // Debug: Cek sheet data
  
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
          // Pastikan kolom id, key, dan tipedata ada dan tidak kosong
          if (!row.id || !row.key || !row.tipedata || row.tipedata.trim() === '') {
            console.log("Skipping row with missing or invalid 'id', 'key', or 'tipedata':", row);
            continue; // Langsung lewati baris ini jika tidak valid
          }
  
          let idString = String(row.id || "").trim();
          const keyString = String(row.key || "").trim();
  
          console.log("Raw ID:", idString);
          console.log("Raw Key:", keyString);
          console.log("Tipedata:", row.tipedata);
  
          // Jika Excel mengubah 1,2 menjadi 1.2, kita bisa replace titik dengan koma
          const fixedIdString = idString.replace('.', ','); // Mengganti titik dengan koma jika perlu
  
          // Split id dan key berdasarkan koma
          const ids = fixedIdString.split(",").map((id) => {
            const parsedId = parseInt(id.trim(), 10);
            if (isNaN(parsedId)) {
              throw new Error(`Invalid ID value: ${id}`);
            }
            return parsedId;
          });
  
          const keys = keyString.split(",").map((key) => key.trim());
  
          // Validasi jumlah id dan key
          if (ids.length !== keys.length) {
            throw new Error("Mismatch between the number of IDs and keys.");
          }
  
          const datajson = ids.map((id, index) => ({
            id: id,
            key: keys[index],
          }));
  
          console.log("Processed datajson:", datajson);
  
          // Parsing correct_answer jika diperlukan
          const correctAnswer = JSON.parse(row.correct_answer || "[]");
  
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
      await transaction.rollback();
      console.error(err);
      return res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },
  //export data bank soal
  exportBankSoal: async (req, res) => {
    try {
      // Get ID dari request body
      const { id } = req.body;

      if (!id || !Array.isArray(id) || id.length === 0) {
        return res.status(400).json({
          status: 400,
          message: "ID tidak valid atau kosong",
        });
      }

      // Ambil data bank soal beserta detail soal
      const bankSoalData = await Bank_soal.findAll({
        where: { id: { [Op.in]: id } },
        include: [
          {
            model: Question_form,
            attributes: ["id", "field", "correct_answer", "discussion"],
          },
          {
            model: Type_question,
            attributes: ["name"],
          },
        ],
      });

      if (!bankSoalData.length) {
        return res.status(404).json({
          status: 404,
          message:
            "Tidak ada data bank soal ditemukan untuk ID yang diberikan.",
        });
      }

      // Format data untuk CSV
      const formattedData = [];
      bankSoalData.forEach((bankSoal) => {
        bankSoal.Question_forms.forEach((question, index) => {
          formattedData.push({
            ID_Bank_Soal: bankSoal.id,
            Nama_Bank_Soal: bankSoal.title,
            Kategori_Soal: bankSoal.Type_question?.name || "Tidak Ada",
            No_Soal: index + 1,
            Pertanyaan: question.field,
            Jawaban_Benar: question.correct_answer,
            Pembahasan: question.discussion || "-",
          });
        });
      });

      // Definisikan kolom CSV
      const fields = [
        "ID_Bank_Soal",
        "Nama_Bank_Soal",
        "Kategori_Soal",
        "No_Soal",
        "Pertanyaan",
        "Jawaban_Benar",
        "Pembahasan",
      ];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(formattedData);

      // Header agar file langsung terdownload
      const filename = `export-banksoal-${Date.now()}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      // Kirim CSV langsung ke client
      res.status(200).send(csv);
    } catch (error) {
      console.error("Error ekspor bank soal:", error);
      res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

};
