const { response } = require('../helpers/response.formatter');
const { Banner } = require('../models');
const Validator = require("fastest-validator");
const v = new Validator();
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

    //membuat Banner
    createBanner: async (req, res) => {
        try {
            const schema = {
                image: {
                    type: "string",
                    optional: true
                }
            }
    
            let imageKey;
    
            // Proses upload untuk image
            if (req.files?.image) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.image[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/banner/${uniqueFileName}`,
                    Body: req.files.image[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.image[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
    
                await s3Client.send(command);
    
                imageKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }

            let BannerCreateObj = {
                image: imageKey || null,
            }
    
            // Validasi data input
            const validate = v.validate(BannerCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            let BannerCreate = await Banner.create(BannerCreateObj);
    
            res.status(201).json(response(201, 'success create Banner', BannerCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan semua data Banner
    getBanner: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let BannerGets;
            let totalCount;

            [BannerGets, totalCount] = await Promise.all([
                Banner.findAll({
                    limit: limit,
                    offset: offset
                }),
                Banner.count()
            ]);

            const pagination = generatePagination(totalCount, page, limit, '/api/user/banner/get');

            res.status(200).json({
                status: 200,
                message: 'success get Banner',
                data: BannerGets,
                pagination: pagination
            });

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data Banner berdasarkan id
    getBannerById: async (req, res) => {
        try {
            let BannerGet = await Banner.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika Banner tidak ada
            if (!BannerGet) {
                res.status(404).json(response(404, 'Banner not found'));
                return;
            }
            res.status(200).json(response(200, 'success get Banner by id', BannerGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate Banner berdasarkan id
    updateBanner: async (req, res) => {
        try {
            let BannerGet = await Banner.findOne({
                where: {
                    id: req.params.id
                }
            });
    
            // Cek apakah data Banner ada
            if (!BannerGet) {
                res.status(404).json(response(404, 'Banner not found'));
                return;
            }
    
            const schema = {
                image: {
                    type: "string",
                    optional: true
                }
            };
    
            let imageKey;
    
            // Upload image jika ada
            if (req.files?.image) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.image[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/banner/${uniqueFileName}`,
                    Body: req.files.image[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.image[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);
    
                imageKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }

    
            // Buat object BannerUpdateObj
            let BannerUpdateObj = {
                image: imageKey || BannerGet.image
            };
    
            const validate = v.validate(BannerUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // Update data Banner
            await Banner.update(BannerUpdateObj, {
                where: {
                    id: req.params.id,
                }
            });
    
            // Ambil data setelah update
            let BannerAfterUpdate = await Banner.findOne({
                where: {
                    id: req.params.id,
                }
            });
    
            res.status(200).json(response(200, 'success update Banner', BannerAfterUpdate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    
    //menghapus Banner berdasarkan id
    deleteBanner: async (req, res) => {
        try {
            let BannerGet = await Banner.findOne({
                where: {
                    id: req.params.id
                }
            })
            if (!BannerGet) {
                res.status(404).json(response(404, 'Banner not found'));
                return;
            }

            await Banner.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete Banner'));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    }
}