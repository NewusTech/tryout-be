const { response } = require('../helpers/response.formatter');
const { Why_us } = require('../models');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op, Sequelize } = require('sequelize');
const { generatePagination } = require('../pagination/pagination');
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

    //membuat why us
    createWhyUs: async (req, res) => {
        try {
            const schema = {
                title: { type: "string", min: 3 },
                description: { type: "string", min: 3 },
            }
    
            // Buat object why us
            let WhyUsCreateObj = {
                title: req.body.title,
                description: req.body.description,
            }
    
            const validate = v.validate(WhyUsCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // Buat why us
            let WhyUsCreate = await Why_us.create(WhyUsCreateObj);
    
            res.status(201).json(response(201, 'success create why us', WhyUsCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    
    //mendapatkan semua data why us
    getWhyUs: async (req, res) => {
        try {
            const { search } = req.query;
    
            //create where clause dinamis
            const whereClause = {};
    
            if (search) {
                whereClause[Op.or] = [
                    { title: { [Op.like]: `%${search}%` } },
                    { description: { [Op.like]: `%${search}%` } }
                ];
            }
    
            //get data why us dengan pencarian
            let whyusGet = await Why_us.findAll({
                where: whereClause
            });
    
            //jika why us tidak ditemukan
            if (!whyusGet || whyusGet.length === 0) {
                return res.status(404).json({
                    code: 404,
                    message: 'Why us not found',
                    data: []
                });
            }

            res.status(200).json({
                code: 200,
                message: 'Success get why us',
                data: whyusGet
            });
        } catch (err) {
            console.error('Error:', err.message);
            res.status(500).json({
                code: 500,
                message: 'Internal server error',
                error: err.message
            });
        }
    },

    //mendapatkan data why us berdasarkan id
    getWhyUsById: async (req, res) => {
        try {
            //mendapatkan data why us berdasarkan id
            let WhyusGet = await Why_us.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika why us tidak ada
            if (!WhyusGet) {
                res.status(404).json(response(404, 'why us not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get why us by id', WhyusGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate why us berdasarkan id
    updateWhyUs: async (req, res) => {
        try {
            // Mendapatkan data why us untuk pengecekan
            let WhyUsGet = await Why_us.findOne({
                where: {
                    id: req.params.id
                }
            });
    
            // Cek apakah data why us ada
            if (!WhyUsGet) {
                res.status(404).json(response(404, 'why us not found'));
                return;
            }
    
            // Membuat schema untuk validasi
            const schema = {
                title: { type: "string", min: 3, optional: true },
                description: { type: "string", min: 3, optional: true },
            };
    
    
            // Buat object untuk update why us
            let WhyUsUpdateObj = {
                title: req.body.title,
                description: req.body.description,
            };
    
            // Validasi menggunakan module fastest-validator
            const validate = v.validate(WhyUsUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // Update why us
            await Why_us.update(WhyUsUpdateObj, {
                where: { id: req.params.id }
            });
    
            // Mendapatkan data why us setelah update
            let WhyUsAfterUpdate = await Why_us.findOne({
                where: { id: req.params.id }
            });
    
            // Response sukses
            res.status(200).json(response(200, 'success update why us', WhyUsAfterUpdate));
    
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus why us berdasarkan id
    deleteWhyUs: async (req, res) => {
        try {

            //mendapatkan data why us untuk pengecekan
            let WhyUsGet = await Why_us.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data compro ada
            if (!WhyUsGet) {
                res.status(404).json(response(404, 'why us not found'));
                return;
            }

            await Why_us.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete why us'));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    }
}