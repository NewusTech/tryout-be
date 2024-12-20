const { response } = require('../helpers/response.formatter');

const { User, Role, Type_package, User_info, Payment, Type_payment, sequelize } = require('../models');
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
            const search = req.query.search ?? null;
            const typepackage_id = req.query.typepackage_id ?? null;
            const startDate = req.query.startDate ?? null; 
            const endDate = req.query.endDate ?? null;
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
    
            //filter by arrange date
            if (startDate && endDate) {
                whereCondition.createdAt = {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                };
            } else if (startDate) {
                whereCondition.createdAt = {
                    [Op.gte]: new Date(startDate)
                };
            } else if (endDate) {
                whereCondition.createdAt = {
                    [Op.lte]: new Date(endDate)
                };
            }
    
            //filter by typepackage_id
            if (typepackage_id) {
                whereCondition.typepackage_id = typepackage_id;
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
                                }
                            ]
                        },
                        {
                            model: User_info,
                            as: 'User_info',
                            where: search ? {
                                [Op.or]: [
                                    { name: { [Op.like]: `%${search}%` } }
                                ]
                            } : undefined,
                        },
                        {
                            model: Type_package,
                            where: typepackage_id ? { id: typepackage_id } : undefined 
                        },
                    ],
                    limit: limit,
                    offset: offset,
                    attributes: { exclude: ['Payment', 'User_info'] },
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
                                    { name: { [Op.like]: `%${search}%` } }
                                ]
                            } : undefined,
                        },
                        {
                            model: Type_package,
                            where: typepackage_id ? { id: typepackage_id } : undefined
                        },
                    ],
                    where: whereCondition
                })
            ]);
    
            //format return data
            let formattedUsers = userGets.map(user => {
                return {
                    id: user.id,
                    slug: user.slug,
                    name: user.User_info?.name,
                    email: user.User_info?.email,
                    type_package: user.Type_package?.name,
                    payment_id: user.Payment?.id,
                    metode_payment: user.Payment?.Type_payment?.title ?? null,
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
            res.status(500).json({
                status: 500,
                message: 'internal server error',
                error: err.message
            });
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
                attributes: ['id', 'no_payment', 'price', 'user_id', 'createdAt', 'status'], // Tambahkan user_id untuk relasi
                include: [
                    {
                        model: Type_payment,
                        attributes: ['id', 'title'],
                    },
                    {
                        model: User,
                        attributes: ['id', 'slug', 'userinfo_id', 'typepackage_id'],
                        include: [
                            {
                                model: User_info,
                                attributes: ['id', 'name'],
                            },
                            {
                                model: Type_package,
                                attributes: ['id', 'name'], 
                            },
                        ],
                    },
                ],
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
            const name = payment?.Users?.[0]?.User_info?.name || '';
            const packageTitle = payment?.Users?.[0]?.Type_package?.name || '';

            htmlContent = htmlContent.replace('{{metodePayment}}', payment.Type_payment.title ?? '');
            htmlContent = htmlContent.replace('{{noPayment}}', payment?.no_payment ?? '');
            htmlContent = htmlContent.replace('{{tanggal}}',tanggalInfo);
            htmlContent = htmlContent.replace('{{time}}', waktuInfo);
            htmlContent = htmlContent.replace('{{pricePackage}}', payment?.price ?? '');
            htmlContent = htmlContent.replace('{{price}}', payment?.price ?? '');
            htmlContent = htmlContent.replace('{{status}}', statusText ?? '');
           
            htmlContent = htmlContent.replace('{{name}}', name);
            htmlContent = htmlContent.replace('{{packageTitle}}', packageTitle);

            console.log('Payment Data:', JSON.stringify(payment, null, 2));


            // Jalankan Puppeteer dan buat PDF
            const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A5',
               
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

    getPaymentPrintPDF: async (req, res) => {
        try {
          let { search, typepayment_id } = req.query;
          let year = req.query.year ? parseInt(req.query.year) : null;
          let month = req.query.month ? parseInt(req.query.month) : null;
      
          let whereCondition = {};
      
          if (typepayment_id) {
            whereCondition.typepayment_id = typepayment_id;
          }
      
          if (search) {
            whereCondition[Op.or] = [
              { nama: { [Op.like]: `%${search}%` } },
              { nip: { [Op.like]: `%${search}%` } },
            ];
          }
      
          if (year && month) {
            whereCondition.createdAt = {
              [Op.between]: [
                new Date(year, month - 1, 1),
                new Date(year, month, 0, 23, 59, 59, 999),
              ],
            };
          } else if (year) {
            whereCondition.createdAt = {
              [Op.between]: [
                new Date(year, 0, 1),
                new Date(year, 11, 31, 23, 59, 59, 999),
              ],
            };
          } else if (month) {
            const currentYear = new Date().getFullYear();
            whereCondition.createdAt = {
              [Op.and]: [
                { [Op.gte]: new Date(currentYear, month - 1, 1) },
                { [Op.lte]: new Date(currentYear, month, 0, 23, 59, 59, 999) },
              ],
            };
          }
      
          const payment = await Payment.findAll({
            where: whereCondition,
            attributes: ['id', 'user_id', 'no_payment', 'price', 'typepayment_id', 'createdAt'],
            include: [
                {
                    model: Type_payment,
                    attributes: ['id', 'title'],
                },
                {
                    model: User,
                    attributes: ['id', 'userinfo_id'],
                    include: [
                        {
                            model: User_info,
                            attributes: ['id', 'name'],

                        },
                    ]
                },
            ]
          });
          
          if (!payment || payment.length === 0) {
            return res.status(404).json({
                status: 404,
                message: "No payments found",
            });
        }
      
          // Baca template HTML
          const templatePath = path.resolve(__dirname, "../views/payment_print_template.html"
          );
    
          let htmlContent = fs.readFileSync(templatePath, "utf8");
      
          console.log('data:', JSON.stringify(payment, null, 2));
        
          const payments = payment[0]; 
          const tanggalInfo = new Date(payments?.createdAt).toLocaleDateString('id-ID', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric'
        });
          
          htmlContent = htmlContent.replace('{{metodePayment}}', payments.Type_payment.title ?? null );
          htmlContent = htmlContent.replace('{{noPayment}}', payments?.no_payment ?? null );
          htmlContent = htmlContent.replace('{{tanggal}}', tanggalInfo);
          htmlContent = htmlContent.replace('{{price}}', payments?.price ?? '0');
          htmlContent = htmlContent.replace('{{name}}', payments?.Users?.[0]?.User_info?.name ?? null);

          // Jalankan Puppeteer dan buat PDF
          const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });
          const page = await browser.newPage();
          await page.setContent(htmlContent, { waitUntil: "networkidle0" });
      
          const pdfBuffer = await page.pdf({
            format: "A4",
            margin: {
                top: "0.6in",
                right: "0.2in",
                bottom: "1.08in",
                left: "0.2in",
              },
          });
      
          await browser.close();
      
          const currentDate = new Date().toISOString().replace(/:/g, "-");
          const filename = `feedback-user-${currentDate}.pdf`;
      
          // Simpan buffer PDF untuk debugging
          fs.writeFileSync("output.pdf", pdfBuffer);
      
          // Set response headers
          res.setHeader(
            "Content-disposition",
            `attachment; filename="${filename}"`
          );
          res.setHeader("Content-type", "application/pdf");
          res.end(pdfBuffer);
        } catch (error) {
          console.error("Error generating PDF:", error);
          res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
          });
        }
    },



}