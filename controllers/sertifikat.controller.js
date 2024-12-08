const { response } = require('../helpers/response.formatter');
const { Setting_sertifikat, Question_form_num, Package_tryout, User_info, User, sequelize } = require('../models');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Validator = require("fastest-validator");
const v = new Validator();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const axios = require("axios");

const s3Client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    useAccelerateEndpoint: true
});

module.exports = {

    getSettingSertifikat: async (req, res) => {
        try {
            //mendapatkan data sertifikat berdasarkan id
            let sertifikatGet = await Setting_sertifikat.findOne();

            //cek jika sertifikat tidak ada
            if (!sertifikatGet) {
                res.status(404).json(response(404, 'setting sertifikat not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get setting sertifikat', sertifikatGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    getUserSertifikat: async (req, res) => {
        try {
            let question = await Question_form_num.findOne({
                where: {
                    id: req.params.idquestionformnum,
                   
                },
                attributes: ['id','sertifikat'],
                // include: [
                //     {
                //         model: Package_tryout
                //     }
                // ]
            });
    
            if (!question) {
                return res.status(404).send('Data tidak ditemukan');
            }
    
            res.status(200).json(response(200, 'success get data', question));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    updateSettingSertifikat: async (req, res) => {
        try {
            // Cari data sertifikat
            let sertifikatGet = await Setting_sertifikat.findOne();
    
            const schema = {
                title: {
                    type: "string",
                    min: 3,
                    optional: true
                },
                name: {
                    type: "string",
                    min: 3,
                    optional: true
                },
                sign: {
                    type: "string",
                    min: 3,
                    optional: true
                },
            };
    
            let signKey;
    
            // Upload sign jika ada file
            if (req.files?.sign) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.sign[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/sign/${uniqueFileName}`,
                    Body: req.files.sign[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.sign[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);
    
                signKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }
    
            // Data yang akan diupdate atau dibuat
            let descUpdateObj = {
                title: req.body.title,
                name: req.body.name,
                sign: signKey || sertifikatGet?.sign || null,
            };
    
            // Validasi input
            const validate = v.validate(descUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            let descAfterUpdate;
    
            if (sertifikatGet) {
                // Jika data ditemukan, lakukan update
                await Setting_sertifikat.update(descUpdateObj, {
                    where: { id: sertifikatGet.id },
                });
    
                descAfterUpdate = await Setting_sertifikat.findOne();
                res.status(200).json(response(200, 'success update setting sertifikat', descAfterUpdate));
            } else {
                // Jika data tidak ditemukan, lakukan create
                descAfterUpdate = await Setting_sertifikat.create(descUpdateObj);
                res.status(201).json(response(201, 'success create setting sertifikat', descAfterUpdate));
            }
    
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.error(err);
        }
    },
    
    getOutputSertifikat: async (req, res) => {
        try {
            // Ambil data package tryout dan setting sertifikat
            let package = await Package_tryout.findOne({
                where: { id: req.params.idpackage },
                attributes: ['id', 'title'],
            });

            let sertifikat = await Setting_sertifikat.findOne({
                where: { id: 1 },
                attributes: ['id', 'title', 'name', 'sign'],
            });
    
            if (!package) {
                return res.status(404).send('Data tidak ditemukan');
            }
    
            const idforminput = req.params.idforminput ?? null;
            let getdatauser;
    
            if (idforminput) {
                getdatauser = await Question_form_num.findOne({
                    where: { id: req.params.idforminput },
                    attributes: ['id', 'userinfo_id', 'no_ujian', 'skor', 'start_time', 'end_time'],
                    include: [
                        {
                            model: User_info,
                            attributes: ['id', 'name'],
                            include: [{ model: User, attributes: ['id'] }]
                        }
                    ]
                });
            }
    
            if (!getdatauser) {
                return res.status(404).send('Data user tidak ditemukan');
            }
    
            const apiURL = `${process.env.SERVER_URL}/user/history/tryout/${idforminput}`;
            

            let typeQuestionSummary = [];
            try {
                const apiResponse = await axios.get(apiURL);
                if (apiResponse.data && apiResponse.data.data) {
                    typeQuestionSummary = apiResponse.data.data.typeQuestionSummary ?? [];
                    startTime = apiResponse.data.data.startTime ?? '';
                }
            } catch (err) {
                console.error('Error fetching type question summary from API:', err.message);
            }
    
            const templatePath = path.resolve(__dirname, '../views/sertifikat_template.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8');
    
            const tanggalInfo = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const tahunInfo = new Date().toLocaleDateString('id-ID', { year: 'numeric' });
    
            htmlContent = htmlContent.replace('{{packageName}}', package?.title ?? 'Tidak Ditemukan');
            htmlContent = htmlContent.replace('{{settingTitle}}', sertifikat?.title ?? 'Tidak Ditemukan');
            htmlContent = htmlContent.replace('{{settingName}}', sertifikat?.name ?? 'Tidak Ditemukan');
            htmlContent = htmlContent.replace('{{sign}}', sertifikat?.sign ?? 'Tidak Ditemukan');
            htmlContent = htmlContent.replace('{{tahunInfo}}', tahunInfo);
            htmlContent = htmlContent.replace('{{tanggalInfo}}', tanggalInfo);
            htmlContent = htmlContent.replace('{{name}}', getdatauser?.User_info?.name ?? 'Tidak Ditemukan');
            htmlContent = htmlContent.replace('{{noUjian}}', getdatauser.no_ujian ?? 'Tidak Ditemukan');
            htmlContent = htmlContent.replace('{{totalScore}}', Math.floor(getdatauser.skor) ?? '0');
            htmlContent = htmlContent.replace('{{startTime}}', startTime);
    
            //generate dynamic scores per Type Question
            typeQuestionSummary.forEach((typeQuestion) => {
                const typeName = typeQuestion.typeName.toLowerCase().replace(/\s+/g, '');
                const scoreValue = typeQuestion.totalScore ?? '0';
                htmlContent = htmlContent.replace(`{{${typeName}Score}}`, scoreValue);
            });
    
            //jalankan Puppeteer dan buat PDF
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
            const pdfBuffer = await page.pdf({ format: 'A4', landscape: true });
    
            await browser.close();
    
            const currentDate = new Date().toISOString().replace(/:/g, '-');
            const filename = `sertifikat-skd-${currentDate}.pdf`;
    
            fs.writeFileSync('sertifikat.pdf', pdfBuffer);
    
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
    
};
