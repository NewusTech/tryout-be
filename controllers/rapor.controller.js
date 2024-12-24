const { response } = require('../helpers/response.formatter');
const { Setting_sertifikat, Question_form, Question_form_input, Question_form_num, Package_tryout, User_info, User, Bank_package, Bank_soal, Type_question, Provinsi, Kota, Rapor, sequelize } = require('../models');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Validator = require("fastest-validator");
const v = new Validator();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const axios = require("axios");
const moment = require("moment-timezone");

const s3Client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    useAccelerateEndpoint: true
});

module.exports = {

    getRapor: async (req, res) => {
        try {
            const userinfo_id = req.params.userinfo_id;
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
    
            //cek history kosong
            if (!histories.length) {
                return res.status(404).json({
                    code: 404,
                    message: 'Belum mengerjakan tryout',
                    data: [],
                });
            }
    
            const scoreMinimums = {
                "TWK": 65,
                "TIU": 80,
                "TKP": 166,
            };
    
            const formattedHistories = await Promise.all(histories.map(async (history) => {
                if (!history.Package_tryout) {
                    return {
                        id: history.id,
                        message: 'Package tryout data not found',
                    };
                }
    
                //get jawaban pengguna
                const answers = await Question_form_input.findAll({
                    where: { questionformnum_id: history.id },
                    attributes: ['questionform_id', 'data'],
                });
    
                if (!answers.length) {
                    return {
                        id: history.id,
                        title: history.Package_tryout.title,
                        slug: history.Package_tryout.slug,
                        startTime: moment(history.start_time).format('D MMMM YYYY'),
                        endTime: moment(history.end_time).format('D MMMM YYYY'),
                        description: history.Package_tryout.description,
                        message: 'Belum mengerjakan',
                    };
                }
    
                const userAnswers = {};
                answers.forEach((answer) => {
                    userAnswers[answer.questionform_id] = answer.data;
                });
    
                const typeQuestionSummary = [];
                history.Package_tryout.Bank_packages.forEach((bankPackage) => {
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
                    typeQuestionSummary, 
                };
            }));
    
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
    
    getOutputRapor: async (req, res) => {
        try {
            const userinfo_id = req.params.userinfo_id;
    
            if (!userinfo_id) {
                return res.status(400).json({
                    message: 'User not authorized'
                });
            }

            const rapor = await Rapor.findOne({
                where: {
                    userinfo_id: userinfo_id,
                    // status: 1 
                },
                attributes: ['rapor', 'note', 'status', 'updatedAt']
            });
    
            //get data setting sertifikat
            let sertifikat = await Setting_sertifikat.findOne({
                where: { id: 1 },
                attributes: ['id', 'title', 'name', 'sign'],
            });
    
            //get data dari API
            const apiURL = `${process.env.SERVER_URL}/user/rapor/get/${userinfo_id}`;
            let raporData = [];
            try {
                const apiResponse = await axios.get(apiURL);
                if (apiResponse.data && apiResponse.data.data) {
                    raporData = apiResponse.data.data ?? [];
                }
            } catch (err) {
                console.error('Error fetching rapor data from API:', err.message);
                if (err.response && err.response.status === 404) {
                    return res.status(404).json({
                        code: 404,
                        message: err.response.data.message || 'Belum mengerjakan tryout',
                        data: []
                    });
                }
    
                // Jika error lain (500, 403, dll)
                return res.status(500).json({
                    message: 'Error fetching rapor data',
                    error: err.message
                });
            }
    
            if (!raporData.length) {
                return res.status(404).json({
                    message: 'No rapor data found'
                });
            }
    
            //get data user
            let user = await User_info.findOne({
                where: { id: userinfo_id },
                attributes: ['name', 'email', 'alamat', 'tgl_lahir', 'asal_instansi', 'gender', 'telepon', 'provinsi_id', 'kota_id'],
                include: [
                    {
                        model: Provinsi,
                        attributes: ['id', 'name'],
                    },
                    {
                        model: Kota,
                        attributes: ['id', 'name'],
                    },
                ],
            });
    
            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }
    
            
            // Baca template HTML
            const templatePath = path.resolve(__dirname, '../views/rapor_template.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8');
    
            let note = rapor?.note?.trim() ? rapor.note : 'Tidak ada catatan';
            const genderFix = user.gender === 1 ? "Perempuan" : "Laki-laki";
            const tanggalInfo = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const placeholders = {
                '{{name}}': user.name ?? 'Tidak Ditemukan',
                '{{email}}': user.email ?? 'Tidak Ditemukan',
                '{{gender}}': genderFix ?? 'Tidak Ditemukan',
                '{{alamat}}': user.alamat ?? 'Tidak Ditemukan',
                '{{asalInstansi}}': user.asal_instansi ?? 'Tidak Ditemukan',
                '{{telepon}}': user.telepon ?? 'Tidak Ditemukan',
                '{{tglLahir}}': user.tgl_lahir ?? 'Tidak Ditemukan',
                '{{nameProvinsi}}': user.Provinsi?.name ?? 'Tidak Ditemukan',
                '{{nameKota}}': user.Kotum?.name ?? 'Tidak Ditemukan',
                '{{tanggalInfo}}': tanggalInfo,
                '{{title}}': sertifikat?.title ?? 'Tidak Ditemukan',
                '{{settingName}}': sertifikat?.name ?? 'Tidak Ditemukan',
                '{{sign}}': sertifikat?.sign ?? 'Tidak Ditemukan',
                '{{note}}': note  // Tambahkan catatan ke dalam template
            };

            console.log('Note:', note);
    
            for (const [key, value] of Object.entries(placeholders)) {
                htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
            }
    
            //generate baris data untuk tabel
            let tableRows = '';
            let totalScore = 0;
            let totalAverage = 0;
            let statusAkhir = 'Lulus';
    
            raporData.forEach((rapor, index) => {
                const typeQuestionSummary = Array.isArray(rapor.typeQuestionSummary) ? rapor.typeQuestionSummary : [];
    
                const twkScore = typeQuestionSummary.find(tqs => tqs.typeName === 'TWK')?.totalScore ?? 0;
                const tiuScore = typeQuestionSummary.find(tqs => tqs.typeName === 'TIU')?.totalScore ?? 0;
                const tkpScore = typeQuestionSummary.find(tqs => tqs.typeName === 'TKP')?.totalScore ?? 0;
                const totalTryoutScore = twkScore + tiuScore + tkpScore;
    
                tableRows += `
                    <tr>
                        <td>${rapor.title}</td>
                        <td>${twkScore}</td>
                        <td>${tiuScore}</td>
                        <td>${tkpScore}</td>
                        <td>${totalTryoutScore}</td>
                        <td>${rapor.statusTryout}</td>
                    </tr>
                `;
    
                totalScore += totalTryoutScore;
    
                if (rapor.statusTryout === 'Tidak Lulus') {
                    statusAkhir = 'Tidak Lulus';
                }
            });
    
            const totalRapor = raporData.length;
            const averageScore = (totalScore / totalRapor).toFixed(2);
    
            const summaryPlaceholders = {
                '{{tableRows}}': tableRows,
                '{{totalScore}}': totalScore,
                '{{averageScore}}': averageScore,
                '{{statusAkhir}}': statusAkhir
            };
    
            for (const [key, value] of Object.entries(summaryPlaceholders)) {
                htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
            }
    
            //generate PDF menggunakan Puppeteer
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
            const pdfBuffer = await page.pdf({ format: 'A4' });
            await browser.close();
    
            const filename = `rapor-${Date.now()}.pdf`;
            fs.writeFileSync(`output.pdf`, pdfBuffer);
    
            res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-type', 'application/pdf');
            res.end(pdfBuffer);
        } catch (error) {
            console.error('Error generating PDF:', error.message);
            res.status(500).json({ message: 'Internal Server Error', error: error.message });
        }
    },
    
    generateOutputRapor: async (req, res) => {
        try {
            const { slug } = req.params; 
        
            const userInfo = await User_info.findOne({
                where: { slug: slug },
                attributes: ['id', 'slug']
            });
        
            //jika user dengan slug tidak ditemukan
            if (!userInfo) {
                return res.status(404).json({
                    message: "User not found",
                });
            }
        
            const userinfo_id = userInfo.id;
        
            const apiURL = `${process.env.SERVER_URL}/user/rapor/output/get/${userinfo_id}`;
        
            const responsePDF = await axios.get(apiURL, {
                responseType: "arraybuffer",
                headers: { "Cache-Control": "no-cache" },
            });
        
            const pdfBuffer = responsePDF.data;
        
            const timestamp = new Date().getTime();
            const uniqueFileName = `${timestamp}-rapor-${userinfo_id}.pdf`;
        
            const uploadParams = {
                Bucket: process.env.AWS_BUCKET,
                Key: `${process.env.PATH_AWS}/rapor/${uniqueFileName}`,
                Body: pdfBuffer,
                ACL: "public-read",
                ContentType: "application/pdf",
            };
    
            const command = new PutObjectCommand(uploadParams);
            await s3Client.send(command);
        
            //generate URL file PDF di AWS S3
            const raporPath = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
        
            const [rapor, created] = await Rapor.findOrCreate({
                where: { userinfo_id: userinfo_id },
                defaults: {
                    rapor: raporPath,
                    status: 0 
                },
            });
        
            if (!created) {
                //update jika data sudah ada
                await rapor.update({
                    rapor: raporPath,
                    status: 1 
                });
                console.log("Rapor berhasil diperbarui di AWS:", raporPath);
        
                return res.status(200).json({
                    message: "Rapor berhasil diperbarui",
                    raporPath: raporPath,
                });
            }
        
            console.log("Rapor berhasil diunggah ke AWS:", raporPath);
        
            res.status(200).json({
                message: "Rapor berhasil dibuat dan diunggah",
                raporPath: raporPath,
            });
        } catch (error) {
            console.error("Error generating or uploading PDF:", error.message);
            res.status(500).json({
                message: "Failed to generate or upload PDF",
                error: error.message,
            });
        }
    },
    
    getUserRapor: async (req, res) => {
        try {
            //get userinfo_id dari params
            const { userinfo_id } = req.params;
    
            let rapor = await Rapor.findOne({
                where: {
                    userinfo_id: userinfo_id,
                    status: 2
                },
                attributes: ['id', 'userinfo_id', 'rapor', 'status', 'note'],
            });
    
            //jika data tidak ditemukan
            if (!rapor) {
                return res.status(404).json({
                    status: 404,
                    message: 'Data rapor tidak ditemukan untuk userinfo_id ini',
                    data: null
                });
            }
    
            res.status(200).json({
                status: 200,
                message: 'Success mendapatkan data rapor',
                data: {
                    id: rapor.id,
                    userinfo_id: rapor.userinfo_id,
                    rapor: rapor.rapor,
                    status: rapor.status,
                    note: rapor.note,
                },
            });
        } catch (err) {
            
            console.error('Error fetching rapor data:', err);
            res.status(500).json({
                status: 500,
                message: 'Internal server error',
                error: err.message,
            });
        }
    },

    updateStatusRapor: async (req, res) => {
        try {
            const { slug } = req.params;  
    
            const userInfo = await User_info.findOne({
                where: { slug: slug }, 
                attributes: ['id', 'slug']
            });
    
            //kondisi jika user dengan slug tidak ditemukan
            if (!userInfo) {
                return res.status(404).json({
                    status: 404,
                    message: "User dengan slug tersebut tidak ditemukan",
                    data: null
                });
            }
    
            const userinfo_id = userInfo.id;
    
            //cari rapor berdasarkan userinfo_id
            let raporGet = await Rapor.findOne({
                where: {
                    userinfo_id: userinfo_id,
                },
                attributes: ['id', 'rapor', 'userinfo_id', 'status', 'note', 'createdAt', 'updatedAt']
            });
    
            if (!raporGet) {
                return res.status(404).json({
                    status: 404,
                    message: "Rapor tidak ditemukan untuk user ini",
                    data: null
                });
            }
    
            const schema = {
                status: { type: "number", optional: "true"}, 
                note: { type: "string", optional: true, empty: true }
            };
    
            let raporUpdateObj = {
                status: req.body.status,
                note: req.body.note
            };
    
            //validasi data update
            const validate = v.validate(raporUpdateObj, schema);
            if (validate.length > 0) {
                return res.status(400).json({
                    status: 400,
                    message: "Validation failed",
                    errors: validate
                });
            }
    
            //update status rapor
            await Rapor.update(raporUpdateObj, { where: { userinfo_id: userinfo_id } });
    
            //get data terbaru setelah update
            let raporAfterUpdate = await Rapor.findOne({
                where: { userinfo_id: userinfo_id },
                attributes: ['id', 'rapor', 'userinfo_id', 'status', 'note' ,'createdAt', 'updatedAt'],
                include: [
                    {
                        model: User_info,
                        attributes: ['slug'] 
                    }
                ]
            });
    
            res.status(200).json({
                status: 200,
                message: "Success update status rapor",
                data: {
                    id: raporAfterUpdate.id,
                    rapor: raporAfterUpdate.rapor,
                    userinfo_id: raporAfterUpdate.userinfo_id,
                    userinfo_slug: raporAfterUpdate.User_info.slug,
                    status: raporAfterUpdate.status,
                    note: raporAfterUpdate.note,
                    createdAt: raporAfterUpdate.createdAt,
                    updatedAt: raporAfterUpdate.updatedAt
                }
            });
        } catch (err) {
            console.error("Error updating status rapor:", err);
            res.status(500).json({
                status: 500,
                message: "Internal server error",
                error: err.message
            });
        }
    }
    
    

};
