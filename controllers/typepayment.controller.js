const { response } = require('../helpers/response.formatter');

const { Type_payment } = require('../models');
const { generatePagination } = require('../pagination/pagination');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require('sequelize');

module.exports = {

    //mendapatkan semua data type payment
    getTypePayment: async (req, res) => {
        try {
            let typepaymentGets;
            const search = req.query.search ?? null;
            // const provinsi_id = req.query.provinsi_id ?? null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let totalCount;

            let filter = {};

            if (search) {
                filter.name = { [Op.like]: `%${search}%` };
            }
    
            // if (provinsi_id) {
            //     filter.provinsi_id = provinsi_id;
            // }

            [typepaymentGets, totalCount] = await Promise.all([
                Type_payment.findAll({
                    where: filter,
                    limit: limit,
                    offset: offset
                }),
                Type_payment.count({
                    where: filter,
                })
            ]);

            const pagination = generatePagination(totalCount, page, limit, '/api/user/type/payment/get');

            res.status(200).json({
                status: 200,
                message: 'success get type payment',
                data: typepaymentGets,
                pagination: pagination
            });

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data type payment berdasarkan id
    getTypePaymentById: async (req, res) => {
        try {
            //mendapatkan data type payment berdasarkan id
            let typepaymentGet = await Type_payment.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika type payment tidak ada
            if (!typepaymentGet) {
                res.status(404).json(response(404, 'type payment not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get type payment by id', typepaymentGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //create data type payment
    createTypePayment: async (req, res) => {
        try {

            //membuat schema untuk validasi
            const schema = {
                title: {
                    type: "string"
                },
            }

            //buat object tipe payment
            let typepaymentCreateObj = {
                title: req.body.title,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typepaymentCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //buat type payment
            let typepaymentCreate = await Type_payment.create(typepaymentCreateObj);

            res.status(201).json(response(201, 'success create type payment', typepaymentCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate type payment berdasarkan id
    updateTypePayment: async (req, res) => {
        try {
            //mendapatkan data type payment untuk pengecekan
            let typepaymentGet = await Type_payment.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type payment ada
            if (!typepaymentGet) {
                res.status(404).json(response(404, 'type payment not found'));
                return;
            }

            //membuat schema untuk validasi
            const schema = {
                title: {
                    type: "string",
                    optional: true
                },
            }

            //buat object type payment
            let typepaymentUpdateObj = {
                title: req.body.title,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typepaymentUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //update typepayment
            await Type_payment.update(typepaymentUpdateObj, {
                where: {
                    id: req.params.id,
                }
            })

            //mendapatkan data type payment setelah update
            let typepaymentAfterUpdate = await Type_payment.findOne({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success update type payment', typepaymentAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus type payment berdasarkan id
    deleteTypePayment: async (req, res) => {
        try {

            //mendapatkan data type payment untuk pengecekan
            let typepaymentGet = await Type_payment.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type payment ada
            if (!typepaymentGet) {
                res.status(404).json(response(404, 'type payment not found'));
                return;
            }

            await Type_payment.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete type payment'));

        } catch (err) {
            if (err.name === 'SequelizeForeignKeyConstraintError') {
                res.status(400).json(response(400, 'Data tidak bisa dihapus karena masih digunakan pada tabel lain'));
            } else {
                res.status(500).json(response(500, 'Internal server error', err));
                console.log(err);
            }
        }
    }
}