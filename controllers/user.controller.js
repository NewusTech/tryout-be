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
            // Membuat schema untuk validasi
            const schema = {
                name: { type: "string", min: 3 },
                email: { type: "string", min: 5, max: 50, pattern: /^\S+@\S+\.\S+$/, optional: true },
                telepon: { type: "string", min: 7, max: 15, pattern: /^[0-9]+$/, optional: true },
                password: { type: "string", min: 5, max: 16 },
                role_id: { type: "number", optional: true },
                typepackage_id: { type: "number", optional: true },
                // typepayment_id: { type: "number", optional: true },
                // price: { type: "string", optional: true},
                // receipt: { type: "string", optional: true }
            };

            // let receiptKey;

            // // Proses upload untuk receipt
            // if (req.files?.receipt) {
            //     const timestamp = new Date().getTime();
            //     const uniqueFileName = `${timestamp}-${req.files.receipt[0].originalname}`;
    
            //     const uploadParams = {
            //         Bucket: process.env.AWS_BUCKET,
            //         Key: `${process.env.PATH_AWS}/receipt/${uniqueFileName}`,
            //         Body: req.files.receipt[0].buffer,
            //         ACL: 'public-read',
            //         ContentType: req.files.receipt[0].mimetype
            //     };
    
            //     const command = new PutObjectCommand(uploadParams);
    
            //     await s3Client.send(command);
    
            //     receiptKey = `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uploadParams.Key}`;
            // }
    
            // Validasi
            const validate = v.validate({
                name: req.body.name,
                password: req.body.password,
                role_id: req.body.role_id !== undefined ? Number(req.body.role_id) : undefined,
                email: req.body.email,
                telepon: req.body.telepon,
                typepackage_id: req.body.typepackage_id !== undefined ? Number(req.body.typepackage_id) : undefined,
                // typepayment_id: req.body.typepayment_id !== undefined ? Number(req.body.typepayment_id) : undefined,
                // price: req.body.price,
                // receipt: receiptKey || null
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
    
            // Membuat object untuk create userinfo
            let userinfoCreateObj = {
                name: req.body.name,
                email: req.body.email,
                telepon: req.body.telepon,
                alamat: req.body.alamat,
                slug: slug
            };
    
            // Membuat entri baru di tabel userinfo
            let userinfoCreate = await User_info.create(userinfoCreateObj, { transaction });

            // let paymentCreateObj = {
            //     // typepayment_id: req.body.typepayment_id,
            //     // price: req.body.price,
            //     // receipt: receiptKey || null, 
            // };

            // Membuat entri payment di tabel payments
            // let paymentCreate = await Payment.create(paymentCreateObj, { transaction });
    
            // Membuat object untuk create user
            let userCreateObj = {
                password: passwordHash.generate(req.body.password),
                role_id: req.body.role_id ? Number(req.body.role_id) : undefined,
                typepackage_id: req.body.typepackage_id ? Number(req.body.typepackage_id) : undefined,
                userinfo_id: userinfoCreate.id,
                // payment_id: paymentCreate.id,
                slug: slug
            };
    
            // Membuat user baru
            let userCreate = await User.create(userCreateObj, { transaction });
    
            // Mengirim response dengan bantuan helper response.formatter
            await transaction.commit();
            res.status(201).json(response(201, 'user and payment created', { user: userCreate}));
    
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

            // Mencari data user berdasarkan nik atau email yang disimpan dalam nik
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
                attributes: ['email', 'id', 'telepon'],
                include: [
                    {
                        model: User,
                        attributes: ['password', 'id', 'role_id'],
                        include: [
                            {
                                model: Role,
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

            // check password
            if (!passwordHash.verify(password, userinfo.User.password)) {
                res.status(403).json(response(403, 'password wrong'));
                return;
            }

            // membuat token jwt
            let token = jwt.sign({
                userId: userinfo.id,
                user_akun_id: userinfo.User.id,
                role: userinfo.User.Role.name,
                permission: userinfo.User.permissions.map(permission => permission.name)
            }, baseConfig.auth_secret, {
                expiresIn: 864000 // time expired 
            });

            res.status(200).json(response(200, 'login success', { token: token }));

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

            // Proses upload untuk receipt
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
                receipt: receiptKey || null
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
    
            // Membuat object untuk create userinfo
            let userinfoCreateObj = {
                name: req.body.name,
                email: req.body.email,
                telepon: req.body.telepon,
                alamat: req.body.alamat,
                slug: slug
            };
    
            // Membuat entri baru di tabel userinfo
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

            let paymentCreateObj = {
                no_payment: noPayments,
                typepayment_id: req.body.typepayment_id,
                price: req.body.price,
                receipt: receiptKey || null, 
                status : 1
            };

            // Membuat entri payment di tabel payments
            let paymentCreate = await Payment.create(paymentCreateObj, { transaction });
    
            // Membuat object untuk create user
            let userCreateObj = {
                password: passwordHash.generate(req.body.password),
                role_id: req.body.role_id ? Number(req.body.role_id) : undefined,
                typepackage_id: req.body.typepackage_id ? Number(req.body.typepackage_id) : undefined,
                userinfo_id: userinfoCreate.id,
                payment_id: paymentCreate.id,
                slug: slug
            };
    
            // Membuat user baru
            let userCreate = await User.create(userCreateObj, { transaction });


            // Mengirim response dengan bantuan helper response.formatter
            await transaction.commit();

            const createdAt = new Date(paymentCreate.createdAt);
            const paymentResponse = {
                ...paymentCreate.dataValues, // Salin semua data payment
                type_payment_title: typePayment.title, // Tambahkan title
                time_payment: {
                    date: createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }), // Format tanggal
                    time: createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) // Format waktu
                }
            };

            res.status(201).json(response(201, 'user and payment created', {
                user: userCreate,
                payment: paymentResponse
            }));
    
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

    //mendapatkan semua data user
    getUser: async (req, res) => {
        try {
            const showDeleted = req.query.showDeleted ?? null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let userGets;
            let totalCount;

            const whereCondition = {
                role_id: 2
            };

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
                        },
                    ],
                    limit: limit,
                    offset: offset,
                    attributes: { exclude: ['Role', 'User_info'] },
                    order: [['id', 'ASC']],
                    where: whereCondition,
                }),
                User.count({
                    where: whereCondition
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
            res.status(500).json(response(500, 'internal server error', err));
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
                ],
                attributes: { exclude: ['Role', 'User_info'] }
            });

            //cek jika user tidak ada
            if (!userGet) {
                res.status(404).json(response(404, 'user not found'));
                return;
            }

            const userPackages = await Package_tryout.findAll({
                where: { user_id: userGet.id }
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
                kota_name: userGet.User_info?.Kota?.name,
                createdAt: userGet.createdAt,
                updatedAt: userGet.updatedAt,

                package_tryout: formattedPackages,
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
            const whereCondition = { id: data.user_akun_id };

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