const { response } = require('../helpers/response.formatter');
const { Social_media } = require('../models');
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

    //membuat social media
    createSocialMedia: async (req, res) => {
        try {
            const schema = {
                title: { type: "string", min: 3 },
                link: { type: "string", min: 3 },
            }
    
            // Buat object social media
            let SocialCreateObj = {
                title: req.body.title,
                link: req.body.link,
            }
    
            const validate = v.validate(SocialCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // Buat social media
            let SocialCreate = await Social_media.create(SocialCreateObj);
    
            res.status(201).json(response(201, 'success create social media', SocialCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    
    //mendapatkan semua data about social media
    getSocialMedia: async (req, res) => {
        try {
            //mendapatkan data social media berdasarkan
            let socialGet = await Social_media.findAll();

            //cek jika social media tidak ada
            if (!socialGet) {
                res.status(404).json(response(404, 'social media not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get social media', socialGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data social media berdasarkan id
    getSocialMediaById: async (req, res) => {
        try {
            //mendapatkan data social media berdasarkan id
            let SocialGet = await Social_media.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika social media tidak ada
            if (!SocialGet) {
                res.status(404).json(response(404, 'social media not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get social media by id', SocialGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate social media berdasarkan id
    updateSocialMedia: async (req, res) => {
        try {
            // Mendapatkan data profile untuk pengecekan
            let SocialGet = await Social_media.findOne({
                where: {
                    id: req.params.id
                }
            });
    
            // Cek apakah data social media ada
            if (!SocialGet) {
                res.status(404).json(response(404, 'social media not found'));
                return;
            }
    
            // Membuat schema untuk validasi
            const schema = {
                title: { type: "string", min: 3, optional: true },
                link: { type: "string", min: 3, optional: true },
            };
    
    
            // Buat object untuk update social media
            let SocialUpdateObj = {
                title: req.body.title,
                link: req.body.link,
            };
    
            // Validasi menggunakan module fastest-validator
            const validate = v.validate(SocialUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // Update social media
            await Social_media.update(SocialUpdateObj, {
                where: { id: req.params.id }
            });
    
            // Mendapatkan data social media setelah update
            let SocialAfterUpdate = await Social_media.findOne({
                where: { id: req.params.id }
            });
    
            // Response sukses
            res.status(200).json(response(200, 'success update social media', SocialAfterUpdate));
    
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    

    //menghapus social media berdasarkan id
    deleteSocialMedia: async (req, res) => {
        try {

            //mendapatkan data social media untuk pengecekan
            let SocialGet = await Social_media.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data compro ada
            if (!SocialGet) {
                res.status(404).json(response(404, 'social media not found'));
                return;
            }

            await Social_media.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete social media'));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    }
}