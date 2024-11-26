const { response } = require("../helpers/response.formatter");

const {
  Question_form_input,
  Question_form_num,
  Question_form,
  Package_tryout,
  Type_package,
  User_info,
  Provinsi,
  Kota,
  sequelize,
} = require("../models");
require("dotenv").config();

const Validator = require("fastest-validator");
const v = new Validator();
const fs = require("fs");
const path = require("path");
// const puppeteer = require("puppeteer");
const moment = require("moment-timezone");
const { Op } = require("sequelize");
const { generatePagination } = require("../pagination/pagination");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const nodemailer = require("nodemailer");
const { format } = require("date-fns");
const { id } = require("date-fns/locale");
const crypto = require("crypto");
const axios = require("axios");

const Redis = require("ioredis");
const { log } = require("console");
const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_NAME,
    pass: process.env.EMAIL_PW,
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  useAccelerateEndpoint: true,
});

module.exports = {

  // user input jawaban
  inputFormQuestion: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const idpackage = req.params.idpackage;
        const iduser = req.user.role === "User" ? req.user.userId : req.body.userId;

        if (!iduser) {
            return res.status(403).json(response(403, "User must be logged in", []));
        }

        const { datainput } = req.body;

        if (!datainput || !Array.isArray(datainput)) {
            throw new Error("Invalid input data format");
        }

        let questionFormNum = await Question_form_num.findOne({
            where: { userinfo_id: iduser, packagetryout_id: idpackage },
        });

        if (!questionFormNum) {
            const today = new Date().toISOString().split("T")[0];
            const noUjian = `${crypto.randomBytes(4).toString("hex").toUpperCase()}${today.replace(/-/g, "")}`;

            questionFormNum = await Question_form_num.create(
                {
                    userinfo_id: iduser,
                    status: 1,
                    no_ujian: noUjian,
                    packagetryout_id: idpackage,
                },
                { transaction }
            );
        }

        const idforminput = questionFormNum.id;

        // Ambil semua jawaban pengguna sebelumnya
        const previousAnswers = await Question_form_input.findAll({
            where: { questionformnum_id: idforminput },
        });

        const scoreMapping = new Map();
        const questionIds = datainput.map((item) => item.questionform_id);

        const questions = await Question_form.findAll({
            where: { id: { [Op.in]: questionIds } },
        });

        questions.forEach((q) => {
            scoreMapping.set(q.id, q.correct_answer);
        });

        let totalPoints = parseFloat(questionFormNum.skor || 0);

        for (let item of datainput) {
            const { questionform_id, data } = item;

            const previousAnswer = previousAnswers.find(
                (answer) => answer.questionform_id === questionform_id
            );

            const correctAnswer = scoreMapping.get(questionform_id);

            console.log(`Processing Question ID: ${questionform_id}`);
            console.log(`User's New Answer: ${data}`);
            console.log(`Correct Answer:`, correctAnswer);

            if (Array.isArray(correctAnswer)) {
                // Ambil poin dari jawaban sebelumnya
                const matchedPrevious = correctAnswer.find(
                    (correct) => Number(correct.id) === Number(previousAnswer?.data)
                );

                // Ambil poin dari jawaban baru
                const matchedNew = correctAnswer.find(
                    (correct) => Number(correct.id) === Number(data)
                );

                if (matchedPrevious) {
                    console.log(`Removing Points for Previous Answer: ${matchedPrevious.point || 0}`);
                    totalPoints -= matchedPrevious.point || 0;
                }

                if (matchedNew) {
                    console.log(`Adding Points for New Answer: ${matchedNew.point || 0}`);
                    totalPoints += matchedNew.point || 0;
                }
            } else if (!Array.isArray(correctAnswer)) {
                if (Number(correctAnswer) === Number(previousAnswer?.data)) {
                    console.log(`Removing 5 points for previous correct single answer.`);
                    totalPoints -= 5; // Kurangi poin jika jawaban sebelumnya benar
                }
                if (Number(correctAnswer) === Number(data)) {
                    console.log(`Adding 5 points for new correct single answer.`);
                    totalPoints += 5; // Tambahkan poin jika jawaban baru benar
                }
            }

            // Update atau buat jawaban baru
            if (previousAnswer) {
                await Question_form_input.update(
                    { data },
                    {
                        where: {
                            id: previousAnswer.id,
                        },
                        transaction,
                    }
                );
            } else {
                await Question_form_input.create(
                    {
                        questionformnum_id: idforminput,
                        questionform_id,
                        data,
                    },
                    { transaction }
                );
            }
        }

        console.log("Final Total Points:", totalPoints);

        // Update skor di Question_form_num
        await Question_form_num.update(
            { skor: totalPoints.toFixed(2) },
            { where: { id: idforminput }, transaction }
        );


        await transaction.commit();

        setTimeout(async () => {
          try {
            console.log("Memanggil API generate PDF...");
  
            // Memanggil API generate PDF menggunakan idforminput yang baru saja dibuat
            let apiURL = `${process.env.SERVER_URL}/user/sertifikat/${idpackage}/${idforminput}`;
            console.log(`URL: ${apiURL}`);
  
            const responsePDF = await axios.get(apiURL, {
              responseType: "arraybuffer",
              headers: { "Cache-Control": "no-cache" },
            });
  
            const pdfBuffer = responsePDF.data;
            console.log("PDF berhasil diambil dari API.");
  
            // Upload PDF ke AWS S3
            const timestamp = new Date().getTime();
            const uniqueFileName = `${timestamp}-${idforminput}.pdf`;
  
            const uploadParams = {
              Bucket: process.env.AWS_BUCKET,
              Key: `${process.env.PATH_AWS}/sertifikat/${uniqueFileName}`,
              Body: pdfBuffer,
              ACL: "public-read",
              ContentType: "application/pdf",
            };
  
            const command = new PutObjectCommand(uploadParams);
            await s3Client.send(command);
  
            const sertifikatPath = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
  
            console.log("PDF berhasil di-upload ke AWS S3:", sertifikatPath);
  
            // Update field sertifikat di tabel Layanan_form_num
            const [affectedRows] = await Question_form_num.update(
              { sertifikat: sertifikatPath },
              { where: { id: idforminput } }
            );
  
            if (affectedRows === 0) {
              console.error("Gagal update field sertifikat.");
            } else {
              console.log("Field sertifikat berhasil diupdate.");
            }
          } catch (error) {
            console.error("Error fetching or uploading PDF:", error);
          }
        }, 5000); // Set timeout 1 detik (1000 ms) untuk memberi waktu sebelum memanggil API

        res.status(200).json(
            response(200, "Success input answer", {
                score: totalPoints.toFixed(2),
                inputCount: datainput.length,
            })
        );
    } catch (err) {
        await transaction.rollback();
        console.error("Error:", err);
        res.status(500).json(response(500, "Internal server error", err.message));
    }
  },

  //get input form user
  getDetailInputForm: async (req, res) => {
    try {
      const idquestionnum = req.params.idquestionnum;

      // Fetch Layananformnum details
      let questionformnumData = await Question_form_num.findOne({
        where: {
          id: idquestionnum,
        },
        include: [
          {
            model: Question_form_input,
            include: [
              {
                model: Question_form,
                attributes: { exclude: ["createdAt", "updatedAt", "status"] },
              },
            ],
          },
          {
            model: User_info,
            include: [
              {
                model: Provinsi,
                attributes: { exclude: ["createdAt", "updatedAt"] },
              },
              {
                model: Kota,
                attributes: { exclude: ["createdAt", "updatedAt"] },
              },
            ],
          },
        //   {
        //     model: User_info,
        //     as: "Adminupdate",
        //     attributes: ["id", "name", "nip"],
        //   },
          {
            model: Package_tryout,
            attributes: ["id", "title", "description"],
            include: [
              {
                model: Type_package,
                attributes: ["id", "name"],
              },
            ],
          },
        ],
      });

      if (!questionformnumData) {
        res.status(404).json(response(404, "data not found"));
        return;
      }

      // Cek apakah user sudah input feedback
    //   let feedbackGet = await User_feedback.findOne({
    //     where: {
    //       userinfo_id: layananformnumData.userinfo_id,
    //       layanan_id: layananformnumData.layanan_id,
    //     },
    //   });

      // Format the Layananforminput data
      let formattedInputData = questionformnumData?.Question_form_inputs?.map(
        (datafilter) => {
          let data_key = null;

          if (
            datafilter?.Question_form?.tipedata === "radio" &&
            datafilter?.Question_form?.datajson
          ) {
            const selectedOption = datafilter?.Question_form?.datajson.find(
              (option) => option?.id == datafilter?.data
            );
            if (selectedOption) {
              data_key = selectedOption?.key;
            }
          }

          if (
            datafilter?.Question_form?.tipedata === "checkbox" &&
            datafilter?.Question_form?.datajson
          ) {
            const selectedOptions = JSON.parse(datafilter?.data);
            data_key = selectedOptions
              .map((selectedId) => {
                const option = datafilter?.Question_form?.datajson.find(
                  (option) => option?.id == selectedId
                );
                return option ? option.key : null;
              })
              .filter((key) => key !== null);
          }

          return {
            id: datafilter?.id,
            data: datafilter?.data,
            questionform_id: datafilter?.questionform_id,
            questionformnum_id: datafilter?.questionformnum_id,
            questionform_name: datafilter?.Question_form?.field,
            questionform_datajson: datafilter?.Question_form?.datajson,
            questionform_tipedata: datafilter?.Question_form?.tipedata,
            data_key: data_key ?? null,
          };
        }
      );

      // Embed the formatted questionforminput data into the questionformnum data
      let result = {
        id: questionformnumData?.id,
        packagetryout_id: questionformnumData?.packagetryout_id,
        package_name: questionformnumData?.Package_tryout,
        userinfo_id: questionformnumData?.userinfo_id,
        userinfo: questionformnumData?.User_info,
        // admin_updated: questionformnumData?.Adminupdate,
        createdAt: questionformnumData?.createdAt,
        updatedAt: questionformnumData?.updatedAt,
        Question_form_inputs: formattedInputData ?? null,
        status: questionformnumData?.status,
        sertifikat: questionformnumData?.sertifikat,
        // user_feedback: feedbackGet ? true : false, 
      };

      res.status(200).json(response(200, "success get data", result));
    } catch (err) {
      res.status(500).json(response(500, "Internal server error", err));
      console.log(err);
    }
  },

  //upload surat hasil permohonan
  uploadFileHasil: async (req, res) => {
    try {
      let dataGet = await Layanan_form_num.findOne({
        where: {
          id: req.params.idlayanannum,
        },
      });

      if (!dataGet) {
        res.status(404).json(response(404, "data not found"));
        return;
      }

      //membuat schema untuk validasi
      const schema = {
        fileoutput: { type: "string", optional: true },
      };

      if (req.files && req.files.file) {
        const file = req.files.file[0];
        const timestamp = new Date().getTime();
        const uniqueFileName = `${timestamp}-${file.originalname}`;

        const uploadParams = {
          Bucket: process.env.AWS_BUCKET,
          Key: `${process.env.PATH_AWS}/file_output/${uniqueFileName}`,
          Body: file.buffer,
          ACL: "public-read",
          ContentType: file.mimetype,
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        dataKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
      }

      //buat object instansi
      let fileUpdateObj = {
        fileoutput: req.files.file ? dataKey : undefined,
      };

      //validasi menggunakan module fastest-validator
      const validate = v.validate(fileUpdateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "validation failed", validate));
        return;
      }

      //update instansi
      await Layanan_form_num.update(fileUpdateObj, {
        where: {
          id: req.params.idlayanannum,
        },
      });

      //response menggunakan helper response.formatter
      res.status(200).json(response(200, "success upload output surat"));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //get history tryout form user
  getHistoryFormUser: async (req, res) => {
    try {
      const search = req.query.search ?? null;
      const status = req.query.status ?? null;
      const range = req.query.range;
      const userinfo_id = req.user.role === "User" ? req.user.userId : null;
      const typepackage_id = Number(req.query.typepackage_id);
      const packagetryout_id = Number(req.query.packagetryout_id);
      const start_date = req.query.start_date;
      let end_date = req.query.end_date;
      const year = req.query.year ? parseInt(req.query.year) : null;
      const month = req.query.month ? parseInt(req.query.month) : null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      let history;
      let totalCount;

      const WhereClause = {};
      const WhereClause2 = {};
      const WhereClause3 = {};

      // if (
      //   req.user.role === "Kepala Bidang" ||
      //   req.user.role === "Admin Verifikasi"
      // ) {
      //   WhereClause2.bidang_id = req.user.bidang_id;
      // } else if (
      //   req.user.role === "Super Admin" ||
      //   req.user.role === "Kepala Dinas" ||
      //   req.user.role === "Sekretaris Dinas"
      // ) {
      // }

      // if (req.user.role === 'Admin Verifikasi' || req.user.role === 'Kepala Bidang') {
      //     WhereClause.layanan_id = req.user.layanan_id;
      // }

      if (range == "today") {
        WhereClause.createdAt = {
          [Op.between]: [
            moment().startOf("day").toDate(),
            moment().endOf("day").toDate(),
          ],
        };
      }

      if (userinfo_id) {
        WhereClause.userinfo_id = userinfo_id;
      }
      if (status) {
        WhereClause.status = status;
      }
      if (packagetryout_id) {
        WhereClause.packagetryout_id = packagetryout_id;
      }

      if (start_date && end_date) {
        end_date = new Date(end_date);
        end_date.setHours(23, 59, 59, 999);
        WhereClause.createdAt = {
          [Op.between]: [new Date(start_date), new Date(end_date)],
        };
      } else if (start_date) {
        WhereClause.createdAt = {
          [Op.gte]: new Date(start_date),
        };
      } else if (end_date) {
        end_date = new Date(end_date);
        end_date.setHours(23, 59, 59, 999);
        WhereClause.createdAt = {
          [Op.lte]: new Date(end_date),
        };
      }

      if (typepackage_id) {
        WhereClause2.typepackage_id = typepackage_id;
      }

      if (search) {
        WhereClause3[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { "$Package_tryout.name$": { [Op.like]: `%${search}%` } },
          { "$Package_tryout->Type_package.name$": { [Op.like]: `%${search}%` } },
        ];
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

      [history, totalCount] = await Promise.all([
        Question_form_num.findAll({
          where: WhereClause,
          include: [
            {
              model: Package_tryout,
              attributes: { exclude: ["createdAt", "updatedAt", "slug"] },
              include: [
                {
                  model: Type_package,
                  attributes: { exclude: ["createdAt", "updatedAt"] },
                },
              ],
              where: WhereClause2,
            },
            {
              model: User_info,
              attributes: ["name"],
              where: WhereClause3,
            },
            // {
            //   model: User_info,
            //   as: "Adminupdate",
            //   attributes: ["id", "name", "nip"],
            // },
          ],
          limit: limit,
          offset: offset,
          order: [["id", "DESC"]],
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
              where: WhereClause2,
            },
            {
              model: User_info,
              where: WhereClause3,
            },
            // {
            //   model: User_info,
            //   as: "Adminupdate",
            //   attributes: ["id", "name", "nik"],
            // },
          ],
        }),
      ]);

      let formattedData = history.map((data) => {
        return {
          id: data.id,
          userinfo_id: data?.userinfo_id,
          name: data?.User_info?.name,
          status: data?.status,
          sertifikat: data?.sertifikat,
          packagetryout_id: data?.packagetryout_id,
          package_name: data?.Package_tryout ? data?.Package_tryout?.name : null,
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
        };
      });

      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        `/api/user/history/tryout`
      );

      res.status(200).json({
        status: 200,
        message: "success get",
        data: formattedData,
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json(response(500, "Internal server error", err));
      console.log(err);
    }
  },

  getHistoryById: async (req, res) => {
    try {
      let Packageformnumget = await Question_form_num.findOne({
        where: {
          id: req.params.idquestion_num,
        },
        include: [
          {
            model: Package_tryout,
            attributes: { exclude: [ "createdAt", "updatedAt", "slug"] },
            include: [
              {
                model: Type_package,
                attributes: { exclude: ["createdAt", "updatedAt", "slug"] },
              },
            ],
          },
          {
            model: User_info,
            attributes: ["name"],
          }
        ],
      });

      if (!Packageformnumget) {
        res.status(404).json(response(404, "data not found"));
        return;
      }

      let formattedData = {
        id: Packageformnumget?.id,
        userinfo_id: Packageformnumget?.userinfo_id,
        name: Packageformnumget?.User_info
          ? Packageformnumget?.User_info?.name
          : null,
        status: Packageformnumget?.status,
        packagetryout_id: Packageformnumget?.packagetryout_id,
        package_name: Packageformnumget?.Package_tryout
          ? Packageformnumget?.Package_tryout?.title
          : null,
        typepackage_id:
          Packageformnumget?.Package_tryout && Packageformnumget?.Package_tryout?.Type_package
            ? Packageformnumget?.Package_tryout?.Type_package.id
            : null,
        typepackage_name:
          Packageformnumget?.Package_tryout && Packageformnumget?.Package_tryout?.Type_package
            ? Packageformnumget?.Package_tryout?.Type_package.name
            : null,
        sertifikat: Packageformnumget?.sertifikat,
        createdAt: Packageformnumget?.createdAt,
        updatedAt: Packageformnumget?.updatedAt,
      };

      res.status(200).json(response(200, "success get", formattedData));
    } catch (err) {
      res.status(500).json(response(500, "Internal server error", err));
      console.log(err);
    }
  },

  pdfHistoryFormUser: async (req, res) => {
    try {
      const search = req.query.search ?? null;
      const status = req.query.status ?? null;
      const range = req.query.range;
      const isonline = req.query.isonline ?? null;
      const userinfo_id = data.role === "User" ? data.userId : null;
      let instansi_id = Number(req.query.instansi_id);
      let layanan_id = Number(req.query.layanan_id);
      const start_date = req.query.start_date;
      let end_date = req.query.end_date;
      const year = req.query.year ? parseInt(req.query.year) : null;
      const month = req.query.month ? parseInt(req.query.month) : null;

      let history;

      const WhereClause = {};
      const WhereClause2 = {};
      const WhereClause3 = {};

      if (
        data.role === "Admin Instansi" ||
        data.role === "Admin Verifikasi" ||
        data.role === "Admin Layanan"
      ) {
        instansi_id = data.instansi_id;
      }

      if (data.role === "Admin Layanan") {
        layanan_id = data.layanan_id;
      }

      if (range == "today") {
        WhereClause.createdAt = {
          [Op.between]: [
            moment().startOf("day").toDate(),
            moment().endOf("day").toDate(),
          ],
        };
      }

      if (isonline) {
        WhereClause.isonline = isonline;
      }
      if (userinfo_id) {
        WhereClause.userinfo_id = userinfo_id;
      }
      if (status) {
        WhereClause.status = status;
      }
      if (layanan_id) {
        WhereClause.layanan_id = layanan_id;
      }

      if (start_date && end_date) {
        end_date = new Date(end_date);
        end_date.setHours(23, 59, 59, 999);
        WhereClause.createdAt = {
          [Op.between]: [new Date(start_date), new Date(end_date)],
        };
      } else if (start_date) {
        WhereClause.createdAt = {
          [Op.gte]: new Date(start_date),
        };
      } else if (end_date) {
        end_date = new Date(end_date);
        end_date.setHours(23, 59, 59, 999);
        WhereClause.createdAt = {
          [Op.lte]: new Date(end_date),
        };
      }

      if (instansi_id) {
        WhereClause2.instansi_id = instansi_id;
      }

      if (search) {
        WhereClause3[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { "$Layanan.name$": { [Op.like]: `%${search}%` } },
          { "$Layanan->Instansi.name$": { [Op.like]: `%${search}%` } },
        ];
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
        // Hanya bulan ditentukan
        const currentYear = new Date().getFullYear();
        WhereClause.createdAt = {
          [Op.and]: [
            { [Op.gte]: new Date(currentYear, month - 1, 1) },
            { [Op.lte]: new Date(currentYear, month, 0, 23, 59, 59, 999) },
          ],
        };
      }

      history = await Promise.all([
        Layananformnum.findAll({
          where: WhereClause,
          include: [
            {
              model: Layanan,
              attributes: {
                exclude: ["createdAt", "updatedAt", "status", "slug"],
              },
              include: [
                {
                  model: Instansi,
                  attributes: {
                    exclude: ["createdAt", "updatedAt", "status", "slug"],
                  },
                },
              ],
              where: WhereClause2,
            },
            {
              model: Userinfo,
              attributes: ["name", "nik"],
              where: WhereClause3,
            },
          ],
          order: [["id", "DESC"]],
        }),
      ]);

      let formattedData = history[0].map((data) => {
        return {
          id: data.id,
          userinfo_id: data?.userinfo_id,
          name: data?.Userinfo?.name,
          nik: data?.Userinfo?.nik,
          pesan: data?.pesan,
          status: data?.status,
          tgl_selesai: data?.tgl_selesai,
          isonline: data?.isonline,
          layanan_id: data?.layanan_id,
          layanan_name: data?.Layanan ? data?.Layanan?.name : null,
          layanan_image: data?.Layanan ? data?.Layanan?.image : null,
          instansi_id:
            data?.Layanan && data?.Layanan?.Instansi
              ? data?.Layanan?.Instansi.id
              : null,
          instansi_name:
            data?.Layanan && data?.Layanan?.Instansi
              ? data?.Layanan?.Instansi.name
              : null,
          instansi_image:
            data?.Layanan && data?.Layanan?.Instansi
              ? data?.Layanan?.Instansi.image
              : null,
          createdAt: data?.createdAt,
          updatedAt: data?.updatedAt,
          fileoutput: data?.fileoutput,
          filesertif: data?.filesertif,
          no_request: data?.no_request,
        };
      });

      // Generate HTML content for PDF
      const templatePath = path.resolve(
        __dirname,
        "../views/permohonanperlayanan.html"
      );
      let htmlContent = fs.readFileSync(templatePath, "utf8");
      let layananGet, instansiGet;

      if (layanan_id) {
        layananGet = await Layanan.findOne({
          where: {
            id: layanan_id,
          },
        });
      }

      if (instansi_id) {
        instansiGet = await Instansi.findOne({
          where: {
            id: instansi_id,
          },
        });
      }

      const instansiInfo = instansiGet?.name
        ? `<p>Instansi : ${instansiGet?.name}</p>`
        : "";
      const layananInfo = layananGet?.name
        ? `<p>Layanan : ${layananGet?.name}</p>`
        : "";
      let tanggalInfo = "";
      if (start_date || end_date) {
        const startDateFormatted = start_date
          ? new Date(start_date).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";
        const endDateFormatted = end_date
          ? new Date(end_date).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";
        tanggalInfo = `<p>Periode Tanggal : ${startDateFormatted} s.d. ${
          endDateFormatted ? endDateFormatted : "Hari ini"
        } </p>`;
      }

      if (range === "today") {
        tanggalInfo = `<p>Periode Tanggal : Hari ini </p>`;
      }

      const getStatusText = (status) => {
        switch (status) {
          case 0:
            return "Belum Divalidasi";
          case 1:
            return "Sudah Divalidasi";
          case 2:
            return "Sudah Disetujui";
          case 3:
            return "Proses Selesai";
          case 4:
            return "Ditolak";
          case 5:
            return "Perbaikan/Revisi";
          case 6:
            return "Diperbaiki";
          default:
            return "Status Tidak Diketahui";
        }
      };

      const reportTableRows = formattedData
        ?.map((permohonan) => {
          const createdAtDate = new Date(
            permohonan.createdAt
          ).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          });
          const createdAtTime = new Date(
            permohonan.createdAt
          ).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
          const statusText = getStatusText(permohonan.status);

          return `
                    <tr>
                        <td class="center">${createdAtDate}</td>
                        <td class="center">${createdAtTime} WIB</td>
                        <td>${permohonan.nik}</td>
                        <td>${permohonan.name}</td>
                        <td class="center">${statusText}</td>
                    </tr>
                `;
        })
        .join("");

      htmlContent = htmlContent.replace("{{instansiInfo}}", instansiInfo);
      htmlContent = htmlContent.replace("{{layananInfo}}", layananInfo);
      htmlContent = htmlContent.replace("{{tanggalInfo}}", tanggalInfo);
      htmlContent = htmlContent.replace("{{reportTableRows}}", reportTableRows);

      // Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();

      // Set HTML content
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        margin: {
          top: "1.16in",
          right: "1.16in",
          bottom: "1.16in",
          left: "1.16in",
        },
      });

      await browser.close();

      // Generate filename
      const currentDate = new Date().toISOString().replace(/:/g, "-");
      const filename = `surat-output-${currentDate}.pdf`;

      // Send PDF buffer
      res.setHeader(
        "Content-disposition",
        'attachment; filename="' + filename + '"'
      );
      res.setHeader("Content-type", "application/pdf");
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json(response(500, "Internal server error", err));
      console.log(err);
    }
  },
};
