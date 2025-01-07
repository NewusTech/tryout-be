const { response } = require('../helpers/response.formatter');

const { User, Token, Role, Type_package, User_info, Payment, Type_payment, Package_tryout, User_permission, Permission, Provinsi, Kota, Question_form_num, sequelize } = require('../models');
const baseConfig = require('../config/base.config');
const passwordHash = require('password-hash');
const jwt = require('jsonwebtoken');
const { generatePagination } = require('../pagination/pagination');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('../errorHandler/logger');
const { name } = require('ejs');

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_NAME,
        pass: process.env.EMAIL_PW,
    }
});

const s3Client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    useAccelerateEndpoint: true
});

module.exports = {

    //membuat user baru
    registrasiUser: async (req, res) => {
        const transaction = await sequelize.transaction();
    
        try {
            const schema = {
                name: { type: "string", min: 3 },
                email: { type: "string", min: 5, max: 50, pattern: /^\S+@\S+\.\S+$/ },
                telepon: { type: "string", min: 7, max: 15, pattern: /^[0-9]+$/, optional: true },
                password: { type: "string", min: 5, max: 16 },
                role_id: { type: "number", optional: true },
                typepackage_id: { type: "number", optional: true },
            };
    
            // Validasi input
            const validate = v.validate({
                name: req.body.name,
                password: req.body.password,
                role_id: req.body.role_id !== undefined ? Number(req.body.role_id) : undefined,
                email: req.body.email,
                telepon: req.body.telepon,
                typepackage_id: req.body.typepackage_id !== undefined ? Number(req.body.typepackage_id) : undefined,
            }, schema);
    
            if (validate.length > 0) {
                const errorMessages = validate.map(error => {
                    if (error.type === 'stringMin') {
                        return `${error.field} minimal ${error.expected} karakter`;
                    } else if (error.type === 'stringMax') {
                        return `${error.field} maksimal ${error.expected} karakter`;
                    } else if (error.type === 'stringPattern') {
                        return `${error.field} format tidak valid`;
                    } else {
                        return `${error.field} tidak valid`;
                    }
                });
    
                return res.status(400).json({
                    status: 400,
                    message: errorMessages.join(', ')
                });
            }
    
            const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
            const slug = `${req.body.name}-${timestamp}`;
            const verificationToken = crypto.randomBytes(32).toString("hex");
    
            //craete object untuk create userinfo
            const userinfoCreateObj = {
                name: req.body.name,
                email: req.body.email,
                telepon: req.body.telepon,
                alamat: req.body.alamat,
                slug: slug,
            };
    
            const userinfoCreate = await User_info.create(userinfoCreateObj, { transaction });
    
            const userCreateObj = {
                password: passwordHash.generate(req.body.password),
                role_id: 2,
                typepackage_id: 1,
                userinfo_id: userinfoCreate.id,
                slug: slug,
                verification_token: verificationToken,
                isVerified: false,
            };
    
            //create user baru
            const userCreate = await User.create(userCreateObj, { transaction });
    
            //send email verifikasi
            const verificationLink = `${process.env.SERVER_URL}/verify/account/${verificationToken}`;
            const mailOptions = {
                to: req.body.email,
                from: process.env.EMAIL_NAME,
                subject: 'Verifikasi Akun Anda',
                html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #4A055B;">Halo, ${req.body.name}</h2>

                    <p>
                        Terima kasih telah mendaftar di <strong>Master Education</strong>.
                        Kami senang Anda bergabung! Klik tombol di bawah untuk memverifikasi akun Anda:
                    </p><br>
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${verificationLink}" 
                           style="display: inline-block; padding: 10px 20px; font-size: 16px; color: white; 
                                  background-color: #4A055B; text-decoration: none; border-radius: 5px;">
                           Verifikasi Akun
                        </a><br><br><br>
                    </div>
                    <p>
                        Jika tombol di atas tidak berfungsi, klik link berikut:
                        <br>
                        <a href="${verificationLink}" style="color: #4A055B; word-wrap: break-word;">${verificationLink}</a>
                    </p>
                    <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 14px; color: #777;">
                        Jika Anda tidak mendaftar di Master Education, abaikan email ini.
                    </p>
                    <p style="font-size: 14px; color: #777;">
                        Terima kasih,<br>Tim <strong>Master Education</strong>
                    </p>
                </div>
            `,
            };
    
            transporter.sendMail(mailOptions, async (err) => {
                if (err) {
                    await transaction.rollback();
                    return res.status(500).json({ message: "Gagal mengirim email verifikasi." });
                }
            });
    
            await transaction.commit();
            res.status(201).json({ message: "Registrasi berhasil. Silakan cek email untuk verifikasi." });
    
        } catch (err) {
            await transaction.rollback();
            if (err.name === 'SequelizeUniqueConstraintError') {
                res.status(400).json({
                    status: 400,
                    message: `${err.errors[0].path} sudah terdaftar`
                });
            } else {
                res.status(500).json({
                    status: 500,
                    message: "Terjadi kesalahan pada server",
                    error: err,
                });
            }
        }
    },

    //email verifikasi
    verificationAccount: async (req, res) => {
        try {
            const { token } = req.params;
    
            const user = await User.findOne({ where: { verification_token: token } });
            if (!user) {
                return res.status(400).json({ message: "Token tidak valid." });
            }
    
            user.isVerified = true;
            user.verification_token = null; 
            await user.save();
    
            res.status(200).json({ message: "Akun berhasil diverifikasi." });
        } catch (err) {
            res.status(500).json({ message: "Terjadi kesalahan pada server.", error: err });
        }
    },

    //login user
    loginUser: async (req, res) => {
        try {
            const schema = {
                email: {
                    type: "string",
                    min: 3,
                },
                password: {
                    type: "string",
                    min: 3,
                }
            };

            let email = req.body.email;
            let password = req.body.password;

            // Validasi input
            const validate = v.validate({
                email: email,
                password: password,
            }, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            // Mencari data user berdasarkan telepon atau email yang disimpan dalam email
            let whereClause = {
                [Op.or]: [
                    { name: email },
                    { email: email },
                    { telepon: email }
                ]
            };

            const adminCondition = {};
            adminCondition.deletedAt = null;
            whereClause.deletedAt = null;

            let userinfo = await User_info.findOne({
                where: whereClause,
                attributes: ['name', 'slug', 'email', 'id', 'telepon', 'image_profile'],
                include: [
                    {
                        model: User,
                        attributes: ['password', 'id', 'role_id', 'typepackage_id', 'isVerified'],
                        include: [
                            {
                                model: Role,
                                attributes: ['id', 'name']
                            },
                            {
                                model: Type_package,
                                attributes: ['id', 'name']
                            },
                            {
                                model: Permission,
                                through: User_permission,
                                as: 'permissions'
                            },
                        ],
                        where: adminCondition
                    },
                ],
            });

            // cek apakah user ditemukan
            if (!userinfo) {
                res.status(404).json(response(404, 'User not found'));
                return;
            }

            if (!userinfo.User.isVerified) {
                res.status(403).json(response(403, 'User not verified'));
                return;
            }

            // check password
            if (!passwordHash.verify(password, userinfo.User.password)) {
                res.status(403).json(response(403, 'password wrong'));
                return;
            }

            const typePackage = userinfo.User.Type_package || { id: null, name: null };

            // membuat token jwt
            let token = jwt.sign({
                userId: userinfo.id,
                user_akun_id: userinfo.User.id,
                role: userinfo.User.Role.name,
                permission: userinfo.User.permissions.map(permission => permission.name)
            }, baseConfig.auth_secret, {
                expiresIn: 864000
            });

            res.status(200).json(response(200, 'login success', { 
                token: token,
                username: userinfo.name,
                slug: userinfo.slug,
                profile: userinfo.image_profile,
                typepackage_id : typePackage.id,
                typepackage_name : typePackage.name,
             }));

        } catch (err) {

            logger.error(`Error : ${err}`);
            logger.error(`Error message: ${err.message}`);
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //logout user
    logoutUser: async (req, res) => {
        try {
            //memasukan token kedalam variable
            let token = req.headers.authorization.split(' ')[1];

            //memasukan token ke table token
            let tokenInsert = await Token.create({
                token: token
            });

            //send response
            res.status(200).json(response(200, 'logout success', tokenInsert));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //membuatkan akun user oleh admin
    createUserByAdmin: async (req, res) => {
        const transaction = await sequelize.transaction();
    
        try {
            // Membuat schema untuk validasi
            const schema = {
                name: { type: "string", min: 3 },
                email: { type: "string", min: 5, max: 50, pattern: /^\S+@\S+\.\S+$/, optional: true },
                telepon: { type: "string", min: 7, max: 15, pattern: /^[0-9]+$/, optional: true },
                password: { type: "string", min: 5, max: 16 },
                role_id: { type: "number", optional: true },
                typepackage_id: { type: "number", optional: true },
                typepayment_id: { type: "number", optional: true },
                price: { type: "string", optional: true},
                receipt: { type: "string", optional: true }
            };
    
            let receiptKey;

            if (req.files?.receipt) {
                const timestamp = new Date().getTime();
                const uniqueFileName = `${timestamp}-${req.files.receipt[0].originalname}`;
        
                const uploadParams = {
                    Bucket: process.env.AWS_BUCKET,
                    Key: `${process.env.PATH_AWS}/receipt/${uniqueFileName}`,
                    Body: req.files.receipt[0].buffer,
                    ACL: 'public-read',
                    ContentType: req.files.receipt[0].mimetype
                };
        
                const command = new PutObjectCommand(uploadParams);
        
                await s3Client.send(command);
        
                receiptKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            }


            // Validasi
            const validate = v.validate({
                name: req.body.name,
                password: req.body.password,
                role_id: req.body.role_id !== undefined ? Number(req.body.role_id) : undefined,
                email: req.body.email,
                telepon: req.body.telepon,
                typepackage_id: req.body.typepackage_id !== undefined ? Number(req.body.typepackage_id) : undefined,
                typepayment_id: req.body.typepayment_id !== undefined ? Number(req.body.typepayment_id) : undefined,
                price: req.body.price,
                receipt: receiptKey || null,
                
            }, schema);
    
            if (validate.length > 0) {
                const errorMessages = validate.map(error => {
                    if (error.type === 'stringMin') {
                        return `${error.field} minimal ${error.expected} karakter`;
                    } else if (error.type === 'stringMax') {
                        return `${error.field} maksimal ${error.expected} karakter`;
                    } else if (error.type === 'stringPattern') {
                        return `${error.field} format tidak valid`;
                    } else {
                        return `${error.field} tidak valid`;
                    }
                });
    
                res.status(400).json({
                    status: 400,
                    message: errorMessages.join(', ')
                });
                return;
            }
    
            const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
            const slug = `${req.body.name}-${timestamp}`;
    
            const typePayment = await Type_payment.findOne({
                where: { id: req.body.typepayment_id }
            });
    
            if (!typePayment) {
                res.status(400).json({
                    status: 400,
                    message: 'Type payment tidak ditemukan'
                });
                return;
            }
    
            //create object untuk create userinfo
            let userinfoCreateObj = {
                name: req.body.name,
                email: req.body.email,
                telepon: req.body.telepon,
                alamat: req.body.alamat,
                slug: slug
            };
            let userinfoCreate = await User_info.create(userinfoCreateObj, { transaction });
    
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];
    
            const countToday = await Payment.count({
                where: {
                    createdAt: {
                        [Op.gte]: new Date(todayStr + "T00:00:00Z"),
                        [Op.lte]: new Date(todayStr + "T23:59:59Z"),
                    },
                },
            });
    
            const tanggalFormat = today.toISOString().slice(2, 10).replace(/-/g, "");
            const randomCode = crypto.randomBytes(3).toString("hex").toUpperCase();
            const noPayments = `INV${tanggalFormat}${randomCode}`;
            const verificationToken = crypto.randomBytes(32).toString("hex");
    
            //create user tanpa payment_id
            let userCreateObj = {
                password: passwordHash.generate(req.body.password),
                role_id: 2,
                typepackage_id: req.body.typepackage_id ? Number(req.body.typepackage_id) : undefined,
                userinfo_id: userinfoCreate.id,
                slug: slug,
                verification_token: verificationToken,
                isVerified: false,
            };
            
            let userCreate = await User.create(userCreateObj, { transaction });
            
            //create payment dengan user_id
            let paymentCreateObj = {
                no_payment: noPayments,
                typepayment_id: req.body.typepayment_id,
                price: req.body.price,
                receipt: receiptKey || null,
                user_id: userCreate.id, 
                status: 1
            };
            
            let paymentCreate = await Payment.create(paymentCreateObj, { transaction });
            
            //update payment_id di User
            await userCreate.update({ payment_id: paymentCreate.id }, { transaction });
    
    
            const verificationLink = `${process.env.SERVER_URL}/verify/account/${verificationToken}`;
    
            const mailOptions = {
                to: req.body.email,
                from: process.env.EMAIL_NAME,
                subject: 'Verifikasi Akun Anda',
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color: #4A055B;">Halo, ${req.body.name}</h2>
                        <p>
                            Terima kasih telah mendaftar di <strong>Master Education</strong>.
                            Kami senang Anda bergabung! Klik tombol di bawah untuk memverifikasi akun Anda:
                        </p><br>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="${verificationLink}" 
                               style="display: inline-block; padding: 10px 20px; font-size: 16px; color: white; 
                                      background-color: #4A055B; text-decoration: none; border-radius: 5px;">
                               Verifikasi Akun
                            </a><br><br><br>
                        </div>
                        <p>
                            Jika tombol di atas tidak berfungsi, klik link berikut:
                            <br>
                            <a href="${verificationLink}" style="color: #4A055B; word-wrap: break-word;">${verificationLink}</a>
                        </p>
                        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="font-size: 14px; color: #777;">
                            Jika Anda tidak mendaftar di Master Education, abaikan email ini.
                        </p>
                        <p style="font-size: 14px; color: #777;">
                            Terima kasih,<br>Tim <strong>Master Education</strong>
                        </p>
                    </div>
                `,
            };
    
            //send email verifikasi
            transporter.sendMail(mailOptions, async (err) => {
                if (err) {
                    await transaction.rollback();
                    return res.status(500).json({ message: "Gagal mengirim email verifikasi." });
                }
    
                await transaction.commit();
    
                const createdAt = new Date(paymentCreate.createdAt);
                const paymentResponse = {
                    ...paymentCreate.dataValues,
                    type_payment_title: typePayment.title,
                    time_payment: {
                        date: createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
                        time: createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    }
                };
    
                res.status(201).json(response(201, 'user and payment created', {
                    user: userCreate,
                    payment: paymentResponse
                }));
            });
    
        } catch (err) {
            await transaction.rollback();
            if (err.name === 'SequelizeUniqueConstraintError') {
                res.status(400).json({
                    status: 400,
                    message: `${err.errors[0].path} sudah terdaftar`
                });
            } else {
                res.status(500).json(response(500, 'terjadi kesalahan pada server', err));
            }
            console.log(err);
        }
    },

    //membuatkan akun user oleh admin
    createAdmin: async (req, res) => {
        const transaction = await sequelize.transaction();
    
        try {
            // Membuat schema untuk validasi
            const schema = {
                name: { type: "string", min: 3 },
                email: { type: "string", min: 5, max: 50, pattern: /^\S+@\S+\.\S+$/, optional: true },
                role_id: { type: "number", optional: true },
            };
    
            // Validasi
            const validate = v.validate({
                name: req.body.name,
                password: req.body.password,
                role_id: req.body.role_id !== undefined ? Number(req.body.role_id) : undefined,
                email: req.body.email,
            }, schema);
    
            if (validate.length > 0) {
                const errorMessages = validate.map(error => {
                    if (error.type === 'stringMin') {
                        return `${error.field} minimal ${error.expected} karakter`;
                    } else if (error.type === 'stringMax') {
                        return `${error.field} maksimal ${error.expected} karakter`;
                    } else if (error.type === 'stringPattern') {
                        return `${error.field} format tidak valid`;
                    } else {
                        return `${error.field} tidak valid`;
                    }
                });
    
                res.status(400).json({
                    status: 400,
                    message: errorMessages.join(', ')
                });
                return;
            }
    
            const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
            const slug = `${req.body.name}-${timestamp}`;
            const verificationToken = crypto.randomBytes(32).toString("hex");
    
            // Membuat object untuk create userinfo
            let userinfoCreateObj = {
                name: req.body.name,
                email: req.body.email,
                slug: slug
            };
    
            // Membuat entri baru di tabel userinfo
            let userinfoCreate = await User_info.create(userinfoCreateObj, { transaction });
    
            // Membuat object untuk create user
            let userCreateObj = {
                password: passwordHash.generate(req.body.password),
                role_id: 1,
                userinfo_id: userinfoCreate.id,
                slug: slug,
                verification_token: verificationToken,
                isVerified: false,
            };
    
            // Membuat user baru
            let userCreate = await User.create(userCreateObj, { transaction });
    
            const verificationLink = `${process.env.SERVER_URL}/verify/account/${verificationToken}`;
            const mailOptions = {
                to: req.body.email,
                from: process.env.EMAIL_NAME,
                subject: 'Verifikasi Akun Anda',
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <h2 style="color: #4A055B;">Halo, ${req.body.name}</h2>
                        <p>Terima kasih telah mendaftar di <strong>Master Education</strong>. Klik tombol di bawah untuk memverifikasi akun Anda:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="${verificationLink}" 
                               style="display: inline-block; padding: 10px 20px; font-size: 16px; color: white; 
                                      background-color: #4A055B; text-decoration: none; border-radius: 5px;">
                               Verifikasi Akun
                            </a>
                        </div>
                        <p>Jika tombol di atas tidak berfungsi, klik link berikut:<br>
                            <a href="${verificationLink}" style="color: #4A055B;">${verificationLink}</a>
                        </p>
                    </div>
                `,
            };
    
            // Mengirim email
            await transporter.sendMail(mailOptions);
    
            // Commit transaksi setelah email berhasil dikirim
            await transaction.commit();
    
            res.status(201).json({
                status: 201,
                message: "Registrasi berhasil. Silakan cek email untuk verifikasi.",
            });
    
        } catch (err) {
            // Rollback hanya jika transaksi belum selesai
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
    
            if (err.name === 'SequelizeUniqueConstraintError') {
                res.status(400).json({
                    status: 400,
                    message: `${err.errors[0].path} sudah terdaftar`
                });
            } else if (err.message.includes('Gagal mengirim email')) {
                res.status(500).json({
                    status: 500,
                    message: "Registrasi gagal. Tidak dapat mengirim email verifikasi.",
                });
            } else {
                res.status(500).json({
                    status: 500,
                    message: "Terjadi kesalahan pada server",
                    error: err,
                });
            }
        }
    },
    

    //mendapatkan semua data admin
    getAdmin: async (req, res) => {
        try {
            const search = req.query.search ?? null;
            const showDeleted = req.query.showDeleted ?? null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let userGets;
            let totalCount;
    
            //add where clause untuk user
            const whereCondition = {
                role_id: 1
            };
    
            //add pencarian di kolom slug pada User
            if (search) {
                whereCondition[Op.or] = [
                    { slug: { [Op.like]: `%${search}%` } },
                ];
            }
    
            //filter untuk data yang telah dihapus
            if (showDeleted !== null) {
                whereCondition.deletedAt = { [Op.not]: null };
            } else {
                whereCondition.deletedAt = null;
            }
    
            [userGets, totalCount] = await Promise.all([
                User.findAll({
                    include: [
                        {
                            model: Role,
                            attributes: ['name', 'id'],
                            as: 'Role'
                        },
                        {
                            model: User_info,
                            as: 'User_info',
                            where: search ? {
                                [Op.or]: [
                                    { name: { [Op.like]: `%${search}%` } },
                                    { email: { [Op.like]: `%${search}%` } },
                                ]
                            } : undefined,
                        },
                    ],
                    limit: limit,
                    offset: offset,
                    attributes: { exclude: ['Role', 'User_info'] },
                    order: [['id', 'ASC']],
                    where: whereCondition,
                }),
                User.count({
                    include: [
                        {
                            model: User_info,
                            as: 'User_info',
                            where: search ? {
                                [Op.or]: [
                                    { name: { [Op.like]: `%${search}%` } },
                                    { email: { [Op.like]: `%${search}%` } },
                                ]
                            } : undefined,
                        },
                    ],
                    where: whereCondition,
                })
            ]);
    
            let formattedUsers = userGets.map(user => {
                return {
                    id: user.id,
                    slug: user.slug,
                    name: user.User_info?.name,
                    email: user.User_info?.email,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                };
            });
    
            const pagination = generatePagination(totalCount, page, limit, '/api/user/get');
    
            res.status(200).json({
                status: 200,
                message: 'success get',
                data: formattedUsers,
                pagination: pagination
            });
    
        } catch (err) {
            res.status(500).json({
                status: 500,
                message: 'internal server error',
                error: err.message
            });
            console.log(err);
        }
    },

    //mendapatkan semua data user
    getUser: async (req, res) => {
        try {
            const search = req.query.search ?? null;
            const showDeleted = req.query.showDeleted ?? null;
            const typepackage_id = req.query.typepackage_id ?? null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let userGets;
            let totalCount;
    
            //where clause untuk tabel User
            const whereCondition = {
                role_id: 2
            };
    
            // filter pencarian berdasarkan slug
            if (search) {
                whereCondition[Op.or] = [
                    { slug: { [Op.like]: `%${search}%` } },
                ];
            }
    
            // filter untuk pengguna yang dihapus (soft delete)
            if (showDeleted !== null) {
                whereCondition.deletedAt = { [Op.not]: null };
            } else {
                whereCondition.deletedAt = null;
            }

            //filter berdasarkan typepackage_id
            if (typepackage_id) {
                whereCondition.typepackage_id = typepackage_id;
            }
    
            [userGets, totalCount] = await Promise.all([
                User.findAll({
                    include: [
                        {
                            model: Role,
                            attributes: ['name', 'id'],
                            as: 'Role'
                        },
                        {
                            model: User_info,
                            as: 'User_info',
                            where: search ? {
                                [Op.or]: [
                                    { name: { [Op.like]: `%${search}%` } },
                                    { email: { [Op.like]: `%${search}%` } },
                                ]
                            } : undefined,
                        },
                    ],
                    limit: limit,
                    offset: offset,
                    attributes: { exclude: ['Role', 'User_info'] },
                    order: [['id', 'ASC']],
                    where: whereCondition,
                }),
                User.count({
                    include: [
                        {
                            model: User_info,
                            as: 'User_info',
                            where: search ? {
                                [Op.or]: [
                                    { name: { [Op.like]: `%${search}%` } },
                                    { email: { [Op.like]: `%${search}%` } },
                                ]
                            } : undefined,
                        },
                    ],
                    where: whereCondition,
                })
            ]);
    
            //format return data
            let formattedUsers = userGets.map(user => {
                return {
                    id: user.id,
                    slug: user.slug,
                    name: user.User_info?.name,
                    email: user.User_info?.email,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                };
            });
    
            const pagination = generatePagination(totalCount, page, limit, '/api/user/get');

            res.status(200).json({
                status: 200,
                message: 'success get',
                data: formattedUsers,
                pagination: pagination
            });
    
        } catch (err) {
            res.status(500).json({
                status: 500,
                message: 'internal server error',
                error: err.message
            });
            console.log(err);
        }
    },

    //mendapatkan data user berdasarkan slug
    getUserBySlug: async (req, res) => {
        try {
            const showDeleted = req.query.showDeleted ?? null;
            const whereCondition = { slug: req.params.slug };

            if (showDeleted !== null) {
                whereCondition.deletedAt = { [Op.not]: null };
            } else {
                whereCondition.deletedAt = null;
            }

            let userGet = await User.findOne({
                where: whereCondition,
                include: [
                    {
                        model: Role,
                        attributes: ['name', 'id'],
                        as: 'Role'
                    },
                    {
                        model: User_info,
                        as: 'User_info',
                        include: [
                            {
                                model: Provinsi,
                                attributes: ['name'],
                            },
                            {
                                model: Kota,
                                attributes: ['name'],
                            }
                        ]
                    },
                    {
                        model: Package_tryout,
                        attributes: ['id', 'title', 'slug']
                    }
                ],
                attributes: { exclude: ['Role', 'User_info'] }
            });

            //cek jika user tidak ada
            if (!userGet) {
                res.status(404).json(response(404, 'user not found'));
                return;
            }

            const userPackages = await Package_tryout.findAll({
                where: { typepackage_id: userGet.typepackage_id }
            });            

            const userPeforms = await Question_form_num.findAll({
                where: { userinfo_id: userGet.id },
                include: [
                    {
                        model: Package_tryout,
                        attributes: ['title'],
                    }
                ]
            });

            const formattedPackages = userPackages.map(package => ({
                id: package.id,
                nama_package: package.title,
            }));

            const formattedPeforms = userPeforms.map(performa => ({
                id: performa.id,
                packagetryout_id: performa.packagetryout_id,
                nama_tryout: performa.Package_tryout ? performa.Package_tryout.title : null,
                skor: performa.skor,
            }));

            let formattedUsers = {
                id: userGet.id,
                name: userGet.User_info?.name,
                email: userGet.User_info?.email,
                telepon: userGet.User_info?.telepon,
                alamat: userGet.User_info?.alamat,
                gender: userGet.User_info?.gender,
                asal_instansi: userGet.User_info?.asal_instansi,
                provinsi_id: userGet.User_info?.provinsi_id,
                provinsi_name: userGet.User_info?.Provinsi?.name,
                kota_id: userGet.User_info?.kota_id,
                kota_name: userGet.User_info?.Kotum?.name,
                image_profile: userGet.User_info?.image_profile,
                createdAt: userGet.createdAt,
                updatedAt: userGet.updatedAt,

                program: formattedPackages,
                performa: formattedPeforms,
            };


            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get user by slug', formattedUsers));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    getProfileUser: async (req, res) => {
        try {
            const showDeleted = req.query.showDeleted ?? null;
            const whereCondition = { id: req.user.user_akun_id };

            if (showDeleted !== null) {
                whereCondition.deletedAt = { [Op.not]: null };
            } else {
                whereCondition.deletedAt = null;
            }

            let userGet = await User.findOne({
                where: whereCondition,
                include: [
                    {
                        model: Role,
                        attributes: ['name', 'id'],
                        as: 'Role'
                    },
                    {
                        model: User_info,
                        as: 'User_info',
                    },
                ],
                attributes: { exclude: ['Role', 'User_info'] }
            });

            //cek jika user tidak ada
            if (!userGet) {
                res.status(404).json(response(404, 'user not found'));
                return;
            }

            let formattedUsers = {
                id: userGet.id,
                name: userGet.User_info?.name,
                slug: userGet.User_info?.slug,
                email: userGet.User_info?.email,
                telepon: userGet.User_info?.telepon,
                alamat: userGet.User_info?.alamat,
                provinsi_id: userGet.User_info?.provinsi_id,
                kota_id: userGet.User_info?.kota_id,
                tempat_lahir: userGet.User_info?.tempat_lahir,
                tgl_lahir: userGet.User_info?.tgl_lahir,
                gender: userGet.User_info?.gender,
                asal_instansi: userGet.User_info?.asal_instansi,
                image_profile: userGet.User_info?.image_profile,
                role_id: userGet.Role?.id,
                role_name: userGet.Role?.name,
                createdAt: userGet.createdAt,
                updatedAt: userGet.updatedAt
            };

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get user by id', formattedUsers));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus user berdasarkan slug
    deleteUser: async (req, res) => {
        try {

            //mendapatkan data user untuk pengecekan
            let userGet = await User.findOne({
                where: {
                    slug: req.params.slug,
                    deletedAt: null
                }
            })

            //cek apakah data user ada
            if (!userGet) {
                res.status(404).json(response(404, 'user not found'));
                return;
            }

            await User.update({ deletedAt: new Date() }, {
                where: {
                    slug: req.params.slug
                }
            });

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success delete user'));

        } catch (err) {
            res.status(500).json(response(500, 'Internal server error', err));
            console.log(err);
        }
    },

    changePassword: async (req, res) => {
        const slug = req.params.slug;
        const { oldPassword, newPassword, confirmNewPassword } = req.body;

        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: 'Fields are required' });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: 'New password doesn`t match' });
        }

        try {
            const user = await User.findOne({ where: { slug } });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!passwordHash.verify(oldPassword, user.password)) {
                return res.status(400).json({ message: 'Old password is incorrect' });
            }

            user.password = passwordHash.generate(newPassword);
            await user.save();

            return res.status(200).json({ message: 'Password has been updated.' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Internal server error.' });
        }
    },

    changePasswordFromAdmin: async (req, res) => {
        const slug = req.params.slug;
        const { newPassword, confirmNewPassword } = req.body;

        if (!newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: 'Fields are required' });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: 'New password doesn`t match' });
        }

        try {
            const user = await User.findOne({ where: { slug } });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            user.password = passwordHash.generate(newPassword);
            await user.save();

            return res.status(200).json({ message: 'Password has been updated.' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Internal server error.' });
        }
    },

    forgotPassword: async (req, res) => {
        const { email } = req.body;

        try {
            const user = await User.findOne({
                include: [
                    {
                        model: User_info,
                        attributes: ['email', 'name'],
                        where: { email },
                    }
                ]
            },);

            if (!user) {
                return res.status(404).json({ message: 'Email not registered' });
            }

            const token = crypto.randomBytes(20).toString('hex');
            const resetpasswordexpires = Date.now() + 3600000;

            user.resetpasswordtoken = token;
            user.resetpasswordexpires = resetpasswordexpires;

            await user.save();

            const mailOptions = {
                to: user?.User_info?.email,
                from: process.env.EMAIL_NAME,
                subject: 'Reset Password',
                text: `Halo ${user?.User_info?.name},\n\n
                Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda.
                Untuk mengatur ulang kata sandi, silakan klik tautan berikut atau salin dan tempelkan ke browser Anda:\n
                ${process.env.WEBSITE_URL}/${token}\n\n
                Jika Anda tidak merasa meminta pengaturan ulang kata sandi ini, abaikan email ini. Kata sandi akun Anda tidak akan berubah.\n\n
                Terima kasih.`
            };

            transporter.sendMail(mailOptions, (err) => {
                if (err) {
                    console.error('There was an error: ', err);
                    return res.status(500).json({ message: `${process.env.EMAIL_NAME} ${process.env.EMAIL_PW}Error sending the email.  ${err}` });
                }
                res.status(200).json({ message: 'Email telah dikirim ke dengan instruksi lebih lanjut.' });
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Internal server error.' });
        }
    },

    resetPassword: async (req, res) => {
        const { token } = req.params;
        const { newPassword, confirmNewPassword } = req.body;

        if (!newPassword || !confirmNewPassword) {
            return res.status(400).json({ message: 'Fields are required' });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ message: 'New password doesn`t match' });
        }

        try {
            const user = await User.findOne({
                where: {
                    resetpasswordtoken: token,
                    resetpasswordexpires: { [Op.gt]: Date.now() }
                }
            });

            if (!user) {
                return res.status(400).json({ message: 'The password reset token is invalid or has expired' });
            }

            user.password = passwordHash.generate(newPassword);
            user.resetpasswordtoken = null;
            user.resetpasswordexpires = null;
            await user.save();

            return res.status(200).json({ message: 'Password successfully changed' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Internal server error.' });
        }
    },

    getUserPermissions: async (req, res) => {
        const { userId } = req.params;

        try {
            // Find the user
            const user = await User.findByPk(userId, {
                include: {
                    model: Permission,
                    through: Userpermission,
                    as: 'permissions'
                }
            });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.status(200).json(response(200, 'success get data', { permissions: user?.permissions }));
        } catch (error) {
            logger.error(`Error : ${error}`);
            logger.error(`Error message: ${error.message}`);
            console.error('Error fetching user permissions:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    updateUserPermissions: async (req, res) => {
        const { userId, permissions } = req.body;

        try {
            // Find the user
            const user = await User.findByPk(userId);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Find all permission records that match the given permission names
            const permissionRecords = await Permission.findAll({
                where: {
                    id: permissions
                }
            });

            if (permissionRecords.length !== permissions.length) {
                return res.status(400).json({ message: 'Some permissions not found' });
            }

            // Get the ids of the found permissions
            const permissionIds = permissionRecords.map(permission => permission.id);

            // Remove old permissions
            await User_permission.destroy({
                where: { user_id: userId }
            });

            // Add new permissions
            const userPermissions = permissionIds.map(permissionId => ({
                user_id: userId,
                permission_id: permissionId
            }));

            await User_permission.bulkCreate(userPermissions);

            res.status(200).json({ message: 'Permissions updated successfully' });
        } catch (error) {
            logger.error(`Error : ${error}`);
            logger.error(`Error message: ${error.message}`);
            console.error('Error updating permissions:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}