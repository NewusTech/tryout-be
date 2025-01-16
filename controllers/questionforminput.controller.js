const { response } = require("../helpers/response.formatter");

const {
  Question_form_input,
  Question_form_num,
  Question_form,
  Package_tryout,
  Type_package,
  Bank_package,
  Bank_soal,
  Type_question,
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
const puppeteer = require("puppeteer");
const moment = require("moment-timezone");
const { Op } = require("sequelize");
const { generatePagination } = require("../pagination/pagination");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const nodemailer = require("nodemailer");
const { format } = require("date-fns");
const { id } = require("date-fns/locale");
const crypto = require("crypto");
const axios = require("axios");
const { log } = require("console");

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

  //start time tryout
  startTryoutSession: async (req, res) => {
    const { packagetryout_id } = req.params;
    const userinfo_id = req.user.role === "User" ? req.user.userId : null;

    try {
        if (!userinfo_id) {
            return res.status(403).json({
                code: 403,
                message: 'Forbidden: Only users can access this resource',
            });
        }

        // Ambil sesi terakhir berdasarkan user dan package tryout
        const latestSession = await Question_form_num.findOne({
            where: { userinfo_id, packagetryout_id },
            order: [['attempt', 'DESC']],
        });

        const now = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');

        if (latestSession && moment(latestSession.end_time, 'YYYY-MM-DD HH:mm:ss').isAfter(now)) {
            return res.status(200).json({
                code: 200,
                message: 'Session already active',
                data: {
                    id: latestSession.id,
                    attempt: latestSession.attempt,
                    start_time: latestSession.start_time,
                    end_time: latestSession.end_time,
                    no_ujian: latestSession.no_ujian,
                },
            });
        }

        // Buat no_ujian baru
        const today = moment().format('YYYYMMDD');
        const noUjian = `${crypto.randomBytes(4).toString('hex').toUpperCase()}${today}`;

        const newAttempt = latestSession ? latestSession.attempt + 1 : 1;
        const startTime = now;
        const endTime = moment(now, 'YYYY-MM-DD HH:mm:ss').add(90, 'minutes').format('YYYY-MM-DD HH:mm:ss');

        const newSession = await Question_form_num.create({
            userinfo_id,
            packagetryout_id,
            attempt: newAttempt,
            start_time: startTime, // Simpan sebagai string
            end_time: endTime,     // Simpan sebagai string
            no_ujian: noUjian,
            status: 1,
        });

        return res.status(200).json({
            code: 200,
            message: 'New session started',
            data: {
                id: newSession.id,
                attempt: newSession.attempt,
                start_time: newSession.start_time,
                end_time: newSession.end_time,
                no_ujian: newSession.no_ujian,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message,
        });
    }
  },

  //end time tryout
  stopTryoutSession: async (req, res) => {
      const { packagetryout_id } = req.params;
      const userinfo_id = req.user.role === "User" ? req.user.userId : null;

      try {
          if (!userinfo_id) {
              return res.status(403).json({
                  code: 403,
                  message: 'Forbidden: Only users can access this resource',
              });
          }

          const latestSession = await Question_form_num.findOne({
              where: { userinfo_id, packagetryout_id },
              order: [['attempt', 'DESC']],
          });

          if (!latestSession || latestSession.status === 0) {
              return res.status(400).json({
                  code: 400,
                  message: 'Session is already ended or not found.',
              });
          }

          const now = moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');

          await Question_form_num.update(
              { end_time: now, status: 0 }, // Simpan waktu sebagai string
              { where: { id: latestSession.id } }
          );

          return res.status(200).json({
              code: 200,
              message: 'Session stopped successfully',
              data: {
                  id: latestSession.id,
                  attempt: latestSession.attempt,
                  end_time: now,
              },
          });
      } catch (error) {
          console.error(error);
          return res.status(500).json({
              code: 500,
              message: 'Internal server error',
              error: error.message,
          });
      }
  },

  //user input jawaban
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

        // Tambahkan validasi untuk sesi aktif
        const latestSession = await Question_form_num.findOne({
            where: { userinfo_id: iduser, packagetryout_id: idpackage },
            order: [['attempt', 'DESC']],
        });

        if (!latestSession || new Date() > new Date(latestSession.end_time) || latestSession.status === 0) {
            return res.status(403).json(
                response(403, "Session is not active or has expired. Please start a new session.", [])
            );
        }

        const idforminput = latestSession.id;

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

        let totalPoints = parseFloat(latestSession.skor || 0);

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
                const matchedPrevious = correctAnswer.find(
                    (correct) => Number(correct.id) === Number(previousAnswer?.data)
                );

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
                    totalPoints -= 5; 
                }
                if (Number(correctAnswer) === Number(data)) {
                    console.log(`Adding 5 points for new correct single answer.`);
                    totalPoints += 5;
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
                        packagetryout_id: idpackage,
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

        res.status(200).json(
            response(200, "Success input answer", {
                score: totalPoints.toFixed(2),
                inputCount: datainput.length,
            })
        );

        // Proses generate sertifikat
        setTimeout(async () => {
          try {
            const apiURL = `${process.env.SERVER_URL}/user/sertifikat/${idpackage}/${idforminput}`;

              const responsePDF = await axios.get(apiURL, {
                  responseType: "arraybuffer",
                  headers: { "Cache-Control": "no-cache" },
              });

              const pdfBuffer = responsePDF.data;

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

              await Question_form_num.update(
                  { sertifikat: sertifikatPath },
                  { where: { id: idforminput } }
              );

              console.log("Sertifikat berhasil dibuat dan diunggah:", sertifikatPath);
          } catch (error) {
              console.error("Error fetching or uploading PDF:", error);
          }
      }, 5000);

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
        const userinfo_id = req.user.role === "User" ? req.user.userId : null;
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;

        const WhereClause = {};
        if (userinfo_id) WhereClause.userinfo_id = userinfo_id;

        const histories = await Question_form_num.findAll({
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
                    ],
                },
            ],
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });

        if (!histories.length) {
            return res.status(404).json({
                code: 404,
                message: 'No history found',
                data: [],
            });
        }

        const scoreMinimums = {
            "TWK": 65,
            "TIU": 80,
            "TKP": 166,
        };

        const formattedHistories = histories.map((history) => {
            if (!history.Package_tryout) {
                return {
                    id: history.id,
                    message: 'Package tryout data not found',
                };
            }

            const answers = history.Question_form_inputs?.map((input) => ({
                questionform_id: input.questionform_id,
                data: input.data,
            })) || [];

            const userAnswers = {};
            answers.forEach((answer) => {
                userAnswers[answer.questionform_id] = answer.data;
            });

            const typeQuestionSummary = {};
            history.Package_tryout.Bank_packages.forEach((bankPackage) => {
                const bankSoals = Array.isArray(bankPackage.Bank_soal) 
                    ? bankPackage.Bank_soal 
                    : [bankPackage.Bank_soal].filter(Boolean); // Pastikan Bank_soal adalah array
                
                bankSoals.forEach((bankSoal) => {
                    const typeQuestionId = bankSoal.typequestion_id;
                    const typeName = bankSoal.Type_question?.name || 'Unknown';

                    if (!typeQuestionSummary[typeQuestionId]) {
                        typeQuestionSummary[typeQuestionId] = {
                            typeName,
                            totalQuestions: 0,
                            totalCorrect: 0,
                            totalIncorrect: 0,
                            totalUnanswered: 0,
                            totalScore: 0,
                        };
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

                        typeQuestionSummary[typeQuestionId].totalQuestions += 1;

                        if (userAnswer !== null && userAnswer !== undefined) {
                            if (isCorrect) {
                                typeQuestionSummary[typeQuestionId].totalCorrect += 1;
                                typeQuestionSummary[typeQuestionId].totalScore += points;
                            } else {
                                typeQuestionSummary[typeQuestionId].totalIncorrect += 1;
                            }
                        } else {
                            typeQuestionSummary[typeQuestionId].totalUnanswered += 1;
                        }
                    });
                });
            });

            let isLolos = "Lulus";
            Object.values(typeQuestionSummary).forEach((summary) => {
                const requiredScore = scoreMinimums[summary.typeName] ?? 0;
                if (summary.totalScore < requiredScore) {
                    summary.status = 'Tidak Lulus';
                    isLolos = "Tidak Lulus";
                } else {
                    summary.status = 'Lulus';
                }
            });

            const startTime = new Date(history.start_time);
            const endTime = new Date(history.end_time);
            const durationMs = endTime - startTime;
            const durationFormatted = moment.utc(durationMs).format("HH:mm:ss");

            return {
                id: history.id,
                title: history.Package_tryout.title,
                slug: history.Package_tryout.slug,
                startTime: moment(startTime).format('D MMMM YYYY'),
                endTime: moment(endTime).format('D MMMM YYYY'),
                description: history.Package_tryout.description,
                duration: durationFormatted,
                price: history.Package_tryout.price,
                score: parseInt(history.skor),
                statusTryout: isLolos,
            };
        });

        res.status(200).json({
            code: 200,
            message: 'Success get all histories',
            data: formattedHistories,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message,
        });
    }
  },
  
  //get detail history tryout user by package
  getDetailPackageTryout: async (req, res) => {      
    try {      
        const { packagetryout_id } = req.params;      
        const userinfo_id = req.user.role === "User" ? req.user.userId : null;      
        const page = parseInt(req.query.page) || 1;     
        const limit = parseInt(req.query.limit) || 10;     
        const offset = (page - 1) * limit;     
  
        if (!packagetryout_id) {      
            return res.status(400).json({      
                status: 400,      
                message: "packagetryout_id is required",      
            });      
        }      
  
        const WhereClause = {      
            packagetryout_id: packagetryout_id,      
        };      
  
        if (userinfo_id) {      
            WhereClause.userinfo_id = userinfo_id;      
        }      
  
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
                limit: null,
                offset: null,
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
     
        const paginatedData = finalData.slice(offset, offset + limit);      
   
        const pagination = {      
            totalItems: finalData.length, 
            currentPage: page,      
            totalPages: Math.ceil(finalData.length / limit),      
            pageSize: limit,      
            hasNextPage: offset + limit < finalData.length,      
            hasPreviousPage: page > 1,      
        };      
  
        res.status(200).json({      
            status: 200,      
            message: 'Success get details for package tryout',      
            data: paginatedData,      
            pagination: pagination,      
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
  
  //get history tryout per id question_num
  getHistoryById: async (req, res) => {
    const { idquestion_num } = req.params;

    try {
        const questionFormNum = await Question_form_num.findOne({
            where: { id: idquestion_num },
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
                    ],
                },
            ],
        });

        if (!questionFormNum) {
            return res.status(404).json({
                code: 404,
                message: 'Question form num not found',
                data: null,
            });
        }

        const startTime = new Date(questionFormNum.start_time);
        const endTime = new Date(questionFormNum.end_time);

        const durationMs = endTime - startTime;
        const durationHrs = Math.floor(durationMs / (1000 * 60 * 60));
        const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const durationSecs = Math.floor((durationMs % (1000 * 60)) / 1000);

        const durationFormatted = `${durationHrs.toString().padStart(2, '0')}:${durationMins
            .toString()
            .padStart(2, '0')}:${durationSecs.toString().padStart(2, '0')}`;

        const answers = await Question_form_input.findAll({
            where: { questionformnum_id: idquestion_num },
            attributes: ['questionform_id', 'data'],
        });

        const userAnswers = {};
        answers.forEach((answer) => {
            userAnswers[answer.questionform_id] = answer.data;
        });

        const typeQuestionSummary = {};
        const packageTryout = questionFormNum.Package_tryout;

        packageTryout.Bank_packages.forEach((bankPackage) => {
            const bankSoals = Array.isArray(bankPackage.Bank_soal)
                ? bankPackage.Bank_soal
                : [bankPackage.Bank_soal].filter(Boolean);

            bankSoals.forEach((bankSoal) => {
                const typeQuestionId = bankSoal.typequestion_id;
                const typeName = bankSoal.Type_question?.name || 'Unknown';

                if (!typeQuestionSummary[typeQuestionId]) {
                    typeQuestionSummary[typeQuestionId] = {
                        typeName: typeName,
                        totalQuestions: 0,
                        totalCorrect: 0,
                        totalIncorrect: 0,
                        totalUnanswered: 0,
                        totalScore: 0,
                    };
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

                    typeQuestionSummary[typeQuestionId].totalQuestions += 1;

                    if (userAnswer !== null && userAnswer !== undefined) {
                        if (isCorrect) {
                            typeQuestionSummary[typeQuestionId].totalCorrect += 1;
                            typeQuestionSummary[typeQuestionId].totalScore += points;
                        } else {
                            typeQuestionSummary[typeQuestionId].totalIncorrect += 1;
                        }
                    } else {
                        typeQuestionSummary[typeQuestionId].totalUnanswered += 1;
                    }
                });
            });
        });

        const scoreMinimums = {
          "TWK": 65,
          "TIU": 80,
          "TKP": 166,
        };

        let isLolos = "Lulus";

        Object.values(typeQuestionSummary).forEach((summary) => {
          const requiredScore = scoreMinimums[summary.typeName] ?? 0;
          if (summary.totalScore >= requiredScore) {
              summary.status = 'Lulus';
          } else {
              summary.status = 'Tidak Lulus';
              isLolos = "Tidak Lulus";
          }
      });

        const result = {
            id: packageTryout.id,
            title: packageTryout.title,
            slug: packageTryout.slug,
            startTime: moment(questionFormNum.start_time).format('D MMMM YYYY'),
            endTime: moment(questionFormNum.end_time).format('D MMMM YYYY'),
            description: packageTryout.description,
            duration: durationFormatted,
            price: packageTryout.price,
            score: parseInt(questionFormNum.skor),
            statusTryout: isLolos,
            typeQuestionSummary: Object.values(typeQuestionSummary),
        };

        return res.status(200).json({
            code: 200,
            message: 'Success get details by question form num',
            data: result,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message,
        });
    }
  },

  //get pembahasan by id question_num untuk tiap tryout user
  getDiscussionById: async (req, res) => {
    const { idquestion_num } = req.params;
  
    try {
      // Ambil data Question_form_num berdasarkan ID
      const questionFormNum = await Question_form_num.findOne({
        where: { id: idquestion_num },
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
                        attributes: ['id', 'field', 'tipedata', 'datajson', 'correct_answer', 'discussion'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
  
      if (!questionFormNum) {
        return res.status(404).json({
          code: 404,
          message: 'Question form num not found',
          data: null,
        });
      }
  
      // Hitung durasi dari start_time dan end_time
      const startTime = new Date(questionFormNum.start_time);
      const endTime = new Date(questionFormNum.end_time);
  
      const durationMs = endTime - startTime;
      const durationHrs = Math.floor(durationMs / (1000 * 60 * 60));
      const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const durationSecs = Math.floor((durationMs % (1000 * 60)) / 1000);
  
      const durationFormatted = `${durationHrs.toString().padStart(2, '0')}:${durationMins
        .toString()
        .padStart(2, '0')}:${durationSecs.toString().padStart(2, '0')}`;
  
      // Ambil jawaban pengguna berdasarkan Question_form_num ID
      const answers = await Question_form_input.findAll({
        where: { questionformnum_id: idquestion_num },
        attributes: ['questionform_id', 'data'],
      });
  
      // Mapping jawaban pengguna berdasarkan questionform_id
      const userAnswers = {};
      answers.forEach((answer) => {
        userAnswers[answer.questionform_id] = answer.data;
      });
  
      // Perhitungan status soal
      const totalQuestions = questionFormNum.Package_tryout.Bank_packages.reduce((count, bankPackage) => {
        return count + bankPackage.Bank_soal.Question_forms.length;
      }, 0);
  
      let total_filled = 0;
      let total_unfilled = 0;
      let totalCorrectAnswer = 0;
      let totalUncorrect = 0;
  
      // Format hasil
      const questionForms = questionFormNum.Package_tryout.Bank_packages.flatMap((bankPackage) =>
        bankPackage.Bank_soal.Question_forms.map((questionForm) => {
          const userAnswer = userAnswers[questionForm.id];
          const isAnswered = userAnswer ? true : false;
          let isCorrect = false;
          let pointsEarned = 0;
  
          if (isAnswered) {
            total_filled++;
  
            // Cek apakah jawaban benar
            if (
              typeof questionForm.correct_answer === 'number' ||
              typeof questionForm.correct_answer === 'string'
            ) {
              if (String(userAnswer) === String(questionForm.correct_answer)) {
                isCorrect = true;
                pointsEarned = 5; // Default poin untuk correct answer
                totalCorrectAnswer++;
              } else {
                totalUncorrect++;
              }
            } else if (Array.isArray(questionForm.correct_answer)) {
              const correctAnswerObject = questionForm.correct_answer.find(
                (item) => String(item.id) === String(userAnswer)
              );
              if (correctAnswerObject) {
                isCorrect = true;
                pointsEarned = correctAnswerObject.point || 0;
                totalCorrectAnswer++;
              } else {
                totalUncorrect++;
              }
            }
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
            correct_answer: questionForm.correct_answer,
            answer: userAnswer || null,
            discussion: questionForm.discussion,
            isCorrect: isCorrect,
            points: pointsEarned,
          };
        })
      );
  
      // Urutkan berdasarkan type_question_id lalu id
      questionForms.sort((a, b) => {
        if (a.type_question_id === b.type_question_id) {
          return a.id - b.id;
        }
        return a.type_question_id - b.type_question_id;
      });
  
      const result = {
        id: questionFormNum.id,
        title: questionFormNum.Package_tryout.title,
        slug: questionFormNum.Package_tryout.slug,
        duration: durationFormatted,
        Question_forms: questionForms,
        status: {
          total_questions: totalQuestions,
          total_filled,
          total_unfilled,
          total_correct: totalCorrectAnswer,
          total_uncorrect: totalUncorrect,
        },
      };
  
      return res.status(200).json({
        code: 200,
        message: 'Success get details by question form num',
        data: result,
      });
    } catch (error) {
      console.error(error);
  
      return res.status(500).json({
        code: 500,
        message: 'Internal server error',
        error: error.message,
      });
    }
  },
  
  //get hasil & pembahasan tryout user
  getHistoryResultTryoutById: async (req, res) => {
    const { idquestion_num } = req.params;

    try {
        // Mendapatkan data Question_form_num berdasarkan ID
        const questionFormNum = await Question_form_num.findOne({
            where: { id: idquestion_num },
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
                                            attributes: ['id', 'field', 'tipedata', 'datajson', 'correct_answer', 'discussion'],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        if (!questionFormNum) {
            return res.status(404).json({
                code: 404,
                message: 'Question form num not found',
                data: null,
            });
        }

        // Menghitung durasi
        const startTime = new Date(questionFormNum.start_time);
        const endTime = new Date(questionFormNum.end_time);
        const durationMs = endTime - startTime;
        const durationFormatted = new Date(durationMs).toISOString().substr(11, 8);

        // Mengambil jawaban pengguna
        const answers = await Question_form_input.findAll({
            where: { questionformnum_id: idquestion_num },
            attributes: ['questionform_id', 'data'],
        });

        const userAnswers = {};
        answers.forEach((answer) => {
            userAnswers[answer.questionform_id] = answer.data;
        });

        // Memproses data untuk summary dan detail soal
        const typeQuestionSummary = {};
        const questionForms = [];
        const packageTryout = questionFormNum.Package_tryout;

        packageTryout.Bank_packages.forEach((bankPackage) => {
            const bankSoals = Array.isArray(bankPackage.Bank_soal)
                ? bankPackage.Bank_soal
                : [bankPackage.Bank_soal].filter(Boolean);

            bankSoals.forEach((bankSoal) => {
                const typeQuestionId = bankSoal.typequestion_id;
                const typeName = bankSoal.Type_question?.name || 'Unknown';

                if (!typeQuestionSummary[typeQuestionId]) {
                    typeQuestionSummary[typeQuestionId] = {
                        typeName: typeName,
                        totalQuestions: 0,
                        totalCorrect: 0,
                        totalIncorrect: 0,
                        totalUnanswered: 0,
                        totalScore: 0,
                    };
                }

                bankSoal.Question_forms.forEach((questionForm) => {
                    const correctAnswer = questionForm.correct_answer;
                    const userAnswer = userAnswers[questionForm.id];
                    let isCorrect = false;
                    let points = 0;

                    if (userAnswer !== undefined && userAnswer !== null) {
                        // Jika correctAnswer berupa single value
                        if (typeof correctAnswer === 'string' || typeof correctAnswer === 'number') {
                            isCorrect = String(correctAnswer) === String(userAnswer);
                            points = isCorrect ? 5 : 0;
                        }
                        // Jika correctAnswer berupa array objek
                        else if (Array.isArray(correctAnswer)) {
                            const correctObject = correctAnswer.find(
                                (item) => String(item.id) === String(userAnswer)
                            );
                            if (correctObject) {
                                isCorrect = true;
                                points = correctObject.point || 0;
                            }
                        }
                    }

                    typeQuestionSummary[typeQuestionId].totalQuestions += 1;
                    if (userAnswer !== null && userAnswer !== undefined) {
                        if (isCorrect) {
                            typeQuestionSummary[typeQuestionId].totalCorrect += 1;
                            typeQuestionSummary[typeQuestionId].totalScore += points;
                        } else {
                            typeQuestionSummary[typeQuestionId].totalIncorrect += 1;
                        }
                    } else {
                        typeQuestionSummary[typeQuestionId].totalUnanswered += 1;
                    }

                    questionForms.push({
                        id: questionForm.id,
                        type_question_id: typeQuestionId,
                        type_question_name: typeName,
                        bank_soal_id: bankSoal.id,
                        bank_soal_name: bankSoal.title,
                        field: questionForm.field,
                        tipedata: questionForm.tipedata,
                        datajson: questionForm.datajson,
                        correct_answer: questionForm.correct_answer,
                        answer: userAnswer || null,
                        discussion: questionForm.discussion,
                        isCorrect: isCorrect,
                        points: points,
                    });
                });
            });
        });

        // Mengurutkan hasil berdasarkan type_question_id dan id soal
        questionForms.sort((a, b) => {
            if (a.type_question_id === b.type_question_id) {
                return a.id - b.id;
            }
            return a.type_question_id - b.type_question_id;
        });

        const statusSummary = {
            total_questions: questionForms.length,
            total_filled: questionForms.filter((q) => q.answer !== null).length,
            total_unfilled: questionForms.filter((q) => q.answer === null).length,
            total_correct: questionForms.filter((q) => q.isCorrect).length,
            total_uncorrect: questionForms.filter((q) => !q.isCorrect && q.answer !== null).length,
        };

        const result = {
            id: packageTryout.id,
            title: packageTryout.title,
            slug: packageTryout.slug,
            startTime: moment(questionFormNum.start_time).format('D MMMM YYYY'),
            endTime: moment(questionFormNum.end_time).format('D MMMM YYYY'),
            description: packageTryout.description,
            duration: durationFormatted,
            price: packageTryout.price,
            score: parseFloat(questionFormNum.skor),
            typeQuestionSummary: Object.values(typeQuestionSummary),
            Question_forms: questionForms,
            status: statusSummary,
        };

        return res.status(200).json({
            code: 200,
            message: 'Success get details by question form num',
            data: result,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            code: 500,
            message: 'Internal server error',
            error: error.message,
        });
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
  }

};
