const { response } = require('../helpers/response.formatter');

const { User, Token, Role, Type_package, User_info, Payment, Type_payment, Package_tryout, User_permission, Permission, Provinsi, Kota, Question_form_num, sequelize } = require('../models');
const { generatePagination } = require('../pagination/pagination');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('../errorHandler/logger');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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

    // get seluruh data laporan pembayaran
    getReportPayment: async (req, res) => {
        try {
            const showDeleted = req.query.showDeleted ?? null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let userGets;
            let totalCount;

            const whereCondition = {
                role_id: 2
            }

            if (showDeleted !== null) {
                whereCondition.deletedAt = { [Op.not]: null };
            } else {
                whereCondition.deletedAt = null;
            }

            [userGets, totalCount] = await Promise.all([
                User.findAll({
                    include: [
                        {
                            model: Payment,
                            attributes: ['price', 'receipt', 'id'],
                            as: 'Payment',
                            include: [
                                {
                                    model: Type_payment,
                                    attributes: ['title', 'id'],
                                }]
                        },
                        {
                            model: User_info,
                            as: 'User_info',
                        },
                        {
                            model: Type_package,
                        },
                    ],
                    limit: limit,
                    offset: offset,
                    attributes: { exclude: ['Payment', 'User_info'] },
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
                    type_package: user.Type_package?.name,
                    payment_id: user.Payment?.id,
                    metode_payment: user.Payment?.Type_payment.title ?? null,
                    price: user.Payment?.price ?? null,
                    receipt: user.Payment?.receipt ?? null,
                    tanggal: user.createdAt,
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

    // get seluruh data laporan pembayaran by slug user
    getReportPaymentBySlug: async (req, res) => {
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
                        model: Type_package,
                        attributes: ['name', 'id'],
                    },
                    {
                        model: Payment,
                        attributes: ['price', 'receipt', 'id'],
                        as: 'Payment',
                        include: [
                            {
                                model: Type_payment,
                                attributes: ['title', 'id'],
                            }]
                    },
                    {
                        model: User_info,
                        as: 'User_info'
                    },
                ],
                attributes: { exclude: ['Payment', 'Type_package', 'User_info'] }
            });

            //cek jika user tidak ada
            if (!userGet) {
                res.status(404).json(response(404, 'user not found'));
                return;
            }

            let formattedUsers = {
                id: userGet.id,
                name: userGet.User_info?.name,
                id_payment: userGet.Payment?.id,
                metode_payment: userGet.Payment?.Type_payment.title ?? null,
                price: userGet.Payment?.price,
                receipt: userGet.Payment?.receipt,
                package_user: userGet.Type_package?.name ?? null,
                createdAt: userGet.createdAt,
                updatedAt: userGet.updatedAt
            };

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get report payment by slug', formattedUsers));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    // get seluruh data laporan pembayaran by slug user
    getReceiptPayment: async (req, res) => {
        try {
            let payment = await Payment.findOne({
                where: {
                    id: req.params.idpayment
                },
                attributes: ['id', 'no_payment', 'price', 'createdAt', 'status'],
                include: [
                    {
                        model: Type_payment,
                        attributes: ['id', 'title'],
                    },
                    {
                        model: User_info,
                        attributes: ['id', 'name'],
                    }
                ]
            });

            if (!payment) {
                return res.status(404).send('Data tidak ditemukan');
            }

            // Baca template HTML
            const templatePath = path.resolve(__dirname, '../views/receipt_template.html');
            let htmlContent = fs.readFileSync(templatePath, 'utf8');

            // Log template HTML untuk memastikan tidak ada kesalahan
            console.log(htmlContent);

            const tanggalInfo = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
            const waktuInfo = new Date().toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const statusText = payment?.status == 1 ? 'Sukses' : payment?.status == 0 ? 'Gagal' : 'Tidak Diketahui';

            htmlContent = htmlContent.replace('{{metodePayment}}', payment.Type_payment.title ?? '');
            htmlContent = htmlContent.replace('{{noPayment}}', payment?.no_payment ?? '');
            htmlContent = htmlContent.replace('{{tanggal}}',tanggalInfo);
            htmlContent = htmlContent.replace('{{time}}', waktuInfo);
            htmlContent = htmlContent.replace('{{pricePackage}}', payment?.price ?? '');
            htmlContent = htmlContent.replace('{{price}}', payment?.price ?? '');
            htmlContent = htmlContent.replace('{{status}}', statusText ?? '');
           
            htmlContent = htmlContent.replace('{{nameUser}}', payment?.User_info?.name ?? '');

            // Jalankan Puppeteer dan buat PDF
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: {
                    top: '0.6in',
                    right: '1.08in',
                    bottom: '1.08in',
                    left: '1.08in'
                }
            });

            await browser.close();

            const currentDate = new Date().toISOString().replace(/:/g, '-');
            const filename = `surat-${currentDate}.pdf`;

            fs.writeFileSync('output.pdf', pdfBuffer);

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

}