const { response } = require('../helpers/response.formatter');
const { About_company } = require('../models');
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

    //membuat profile company
    createProfile: async (req, res) => {
        try {
            const schema = {
                title: { type: "string", min: 3 },
                sub_title: { type: "string", min: 3 },
                description: { type: "string", min: 3 },
                telepon: { type: "string", min: 3 },
                email: { type: "string", min: 3 },
                address: { type: "string", min: 3 },
                lat: { type: "string", min: 3 },
                long: { type: "string", min: 3 },
            }
    
            let mainlogoKey, sublogoKey;
    
            if (req.files && req.files.main_logo) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.main_logo[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/company_profile/${uniqueFileName}`,
                    Body: req.files.main_logo[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.main_logo[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);
    
                mainlogoKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }
    
            if (req.files && req.files.sub_logo) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.sub_logo[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/company_profile/${uniqueFileName}`,
                    Body: req.files.sub_logo[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.sub_logo[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);
    
                sublogoKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }
    
            // Buat object profile company
            let ProfileCreateObj = {
                title: req.body.title,
                sub_title: req.body.sub_title,
                description: req.body.description,
                telepon: req.body.telepon,
                email: req.body.email,
                address: req.body.address,
                lat: req.body.lat,
                long: req.body.long,
                main_logo: mainlogoKey || null,
                sub_logo: sublogoKey || null,
            }
    
            const validate = v.validate(ProfileCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // Buat company profile
            let ProfileCreate = await About_company.create(ProfileCreateObj);
    
            res.status(201).json(response(201, 'success create company profile', ProfileCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    
    //mendapatkan semua data about company profile
    getProfile: async (req, res) => {
        try {
            //mendapatkan data compro berdasarkan
            let profileGet = await About_company.findAll();

            //cek jika compro tidak ada
            if (!profileGet) {
                res.status(404).json(response(404, 'Company profile not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get about company', profileGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data company profile berdasarkan slug
    getProfileById: async (req, res) => {
        try {
            //mendapatkan data profile berdasarkan id
            let ProfileGet = await About_company.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika compro tidak ada
            if (!ProfileGet) {
                res.status(404).json(response(404, 'Company profile not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get company profile by id', ProfileGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate company profile berdasarkan id
    updateProfile: async (req, res) => {
        try {
            // Mendapatkan data profile untuk pengecekan
            let ProfileGet = await About_company.findOne({
                where: {
                    id: req.params.id
                }
            });
    
            // Cek apakah data compro ada
            if (!ProfileGet) {
                res.status(404).json(response(404, 'Company profile not found'));
                return;
            }
    
            // Membuat schema untuk validasi
            const schema = {
                title: { type: "string", min: 3, optional: true },
                sub_title: { type: "string", min: 3, optional: true },
                description: { type: "string", min: 3, optional: true },
                telepon: { type: "string", min: 3, optional: true },
                email: { type: "string", min: 3, optional: true },
                address: { type: "string", min: 3, optional: true },
                lat: { type: "string", min: 3, optional: true },
                long: { type: "string", min: 3, optional: true },
                main_logo: { type: "string", min: 3, optional: true },
                sub_logo: { type: "string", min: 3, optional: true },
            };
    
            let mainlogoKey = null;
            let sublogoKey = null;
    
            // Proses upload main logo
            if (req.files && req.files.main_logo) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.main_logo[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/company_profile/${uniqueFileName}`,
                    Body: req.files.main_logo[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.main_logo[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);
    
                mainlogoKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }
    
            // Proses upload sub logo
            if (req.files && req.files.sub_logo) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.sub_logo[0].originalname}`;
    
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/about_bkd/${uniqueFileName}`,
                    Body: req.files.sub_logo[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.sub_logo[0].mimetype
                };
    
                const command = new PutObjectCommand(uploadParams);
                await s3Client.send(command);
    
                sublogoKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }
    
            // Buat object untuk update profile company
            let ProfileUpdateObj = {
                title: req.body.title,
                sub_title: req.body.sub_title,
                description: req.body.description,
                telepon: req.body.telepon,
                email: req.body.email,
                address: req.body.address,
                lat: req.body.lat,
                long: req.body.long,
                main_logo: mainlogoKey || ProfileGet.main_logo,
                sub_logo: sublogoKey || ProfileGet.sub_logo,
            };
    
            // Validasi menggunakan module fastest-validator
            const validate = v.validate(ProfileUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }
    
            // Update company profile
            await About_company.update(ProfileUpdateObj, {
                where: { id: req.params.id }
            });
    
            // Mendapatkan data company profile setelah update
            let ProfileAfterUpdate = await About_company.findOne({
                where: { id: req.params.id }
            });
    
            // Response sukses
            res.status(200).json(response(200, 'success update company profile', ProfileAfterUpdate));
    
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
    

    //menghapus company profile berdasarkan id
    deleteProfile: async (req, res) => {
        try {

            //mendapatkan data company profile untuk pengecekan
            let ProfileGet = await About_company.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data compro ada
            if (!ProfileGet) {
                res.status(404).json(response(404, 'Company profile not found'));
                return;
            }

            await About_company.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete company profile'));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    }
}