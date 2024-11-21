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
    
    
};
