const { response } = require('../helpers/response.formatter');
const { Setting_sertifikat, Question_form_num, Package_tryout, User_info, User, sequelize } = require('../models');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Validator = require("fastest-validator");
const v = new Validator();
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
            let sertifikatGet = await Setting_sertifikat.findOne()

            //cek apakah data sertifikat ada
            if (!sertifikatGet) {
                res.status(404).json(response(404, 'term condition not found'));
                return;
            }

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
            }

            let signKey;
    
            // Upload sign jika ada
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

              let descUpdateObj = {
                title: req.body.title,
                name: req.body.name,
                sign: signKey || sertifikatGet.sign
            };

            console.log("Request body:", req.body);
            console.log("Uploaded file:", req.files?.sign);

            const validate = v.validate(descUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            // Update desc
            await Setting_sertifikat.update(descUpdateObj, {
                where: { id: sertifikatGet.id },
            });
            let descAfterUpdate = await Setting_sertifikat.findOne();

            res.status(200).json(response(200, 'success update setting sertifikat', descAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    
    getOutputSertifikat: async (req, res) => {
        try {
            let package = await Package_tryout.findOne({
                where: {
                    id: req.params.idpackage
                },
                attributes: ['id', 'title'],
                include: [
                    // {
                    //     model: Bidang,
                    //     attributes: ['id', 'nama', 'pj', 'nip_pj'],
                    // },
                    {
                        model: Setting_sertifikat,
                    }
                ]
            });

            if (!package) {
                return res.status(404).send('Data tidak ditemukan');
            }

            const idforminput = req.params.idforminput ?? null;
            let getdatauser;

            if (idforminput) {
                getdatauser = await Question_form_num.findOne({
                    where: {
                      id: req.params.idforminput,
                    },
                    attributes: ['id', 'userinfo_id'],
                    include: [
                      {
                        model: User_info,
                        attributes: ['id', 'name'],
                        include: [
                            {
                                model: User,
                                attributes: ['id'],
                            }
                        ]
                      }
                    ]
                  });
            }

            // Baca template HTML
            const templatePath = path.resolve(__dirname, '../views/sertifikat_template.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8');

            // Log template HTML untuk memastikan tidak ada kesalahan
            console.log(htmlContent);

            const tanggalInfo = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const tahunInfo = new Date().toLocaleDateString('id-ID', { year: 'numeric' }); 

            // htmlContent = htmlContent.replace('{{bidangName}}', package.Bidang.nama ?? '');
            htmlContent = htmlContent.replace('{{packageName}}', package?.name ?? '');
            htmlContent = htmlContent.replace('{{settingTitle}}', package.Setting_sertifikat?.title ?? '');
            htmlContent = htmlContent.replace('{{settingName}}', package.Setting_sertifikat?.name ?? '');
            htmlContent = htmlContent.replace('{{sign}}', package.Setting_sertifikat?.sign ?? '');
            htmlContent = htmlContent.replace('{{tahunInfo}}', tahunInfo);
            htmlContent = htmlContent.replace('{{tanggalInfo}}', tanggalInfo);
            htmlContent = htmlContent.replace('{{name}}', getdatauser?.User_info?.name ?? 'Tidak Ditemukan');
            
            // Jalankan Puppeteer dan buat PDF
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                landscape: true,
            });

            await browser.close();

            const currentDate = new Date().toISOString().replace(/:/g, '-');
            const filename = `setifikat-skd-${currentDate}.pdf`;

            fs.writeFileSync('sertifikat.pdf', pdfBuffer);

            // Set response headers
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
