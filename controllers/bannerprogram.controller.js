const { response } = require('../helpers/response.formatter');
const { Banner_program } = require('../models');
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

    //membuat banner program
    createBannerProgram: async (req, res) => {
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
                    Key: `${process.env.PATH_AWS}/banner_program/${uniqueFileName}`,
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
    
            let BannerCreate = await Banner_program.create(BannerCreateObj);
    
            res.status(201).json(response(201, 'success create Banner', BannerCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan semua data banner program
    getBannerProgram: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let BannerGets;
            let totalCount;

            [BannerGets, totalCount] = await Promise.all([
                Banner_program.findAll({
                    limit: limit,
                    offset: offset
                }),
                Banner_program.count()
            ]);

            const pagination = generatePagination(totalCount, page, limit, '/api/user/banner/program/get');

            res.status(200).json({
                status: 200,
                message: 'Success get banner program',
                data: BannerGets,
                pagination: pagination
            });

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data banner program berdasarkan id
    getBannerProgramById: async (req, res) => {
        try {
            let BannerGet = await Banner_program.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika banner tidak ada
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

    //mengupdate banner berdasarkan id
    updateBannerProgram: async (req, res) => {
        try {
            let BannerGet = await Banner_program.findOne({
                where: {
                    id: req.params.id
                }
            });
    
            // cek apakah data banner ada
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
    
            // upload image jika ada
            if (req.files?.image) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.image[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/banner_program/${uniqueFileName}`,
                    Body: req.files.image[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.image[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);
    
                imageKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }

    
            // buat object BannerUpdateObj
            let BannerUpdateObj = {
                image: imageKey || BannerGet.image
            };
    
            const validate = v.validate(BannerUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // update data banner
            await Banner_program.update(BannerUpdateObj, {
                where: {
                    id: req.params.id,
                }
            });
    
            // get data setelah update
            let BannerAfterUpdate = await Banner_program.findOne({
                where: {
                    id: req.params.id,
                }
            });
    
            res.status(200).json(response(200, 'success update banner program', BannerAfterUpdate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    
    //menghapus banner berdasarkan id
    deleteBannerProgram: async (req, res) => {
        try {
            let BannerGet = await Banner_program.findOne({
                where: {
                    id: req.params.id
                }
            })
            if (!BannerGet) {
                res.status(404).json(response(404, 'banner not found'));
                return;
            }

            await Banner_program.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete banner program'));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    }
}