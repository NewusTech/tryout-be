const { response } = require('../helpers/response.formatter');

const { Type_question } = require('../models');
const { generatePagination } = require('../pagination/pagination');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require('sequelize');

module.exports = {

    //mendapatkan semua data type question
    getTypeQuestion: async (req, res) => {
        try {
            let typequestionGets;
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

            [typequestionGets, totalCount] = await Promise.all([
                Type_question.findAll({
                    where: filter,
                    limit: limit,
                    offset: offset
                }),
                Type_question.count({
                    where: filter,
                })
            ]);

            const pagination = generatePagination(totalCount, page, limit, '/api/user/type/question/get');

            res.status(200).json({
                status: 200,
                message: 'success get type question',
                data: typequestionGets,
                pagination: pagination
            });

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data type question berdasarkan id
    getTypeQuestionById: async (req, res) => {
        try {
            //mendapatkan data type question berdasarkan id
            let typequestionGet = await Type_question.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika type question tidak ada
            if (!typequestionGet) {
                res.status(404).json(response(404, 'type question not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get type question by id', typequestionGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //create data type question
    createTypeQuestion: async (req, res) => {
        try {

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string"
                },
            }

            //buat object tipe question
            let typequestionCreateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typequestionCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //buat type question
            let typequestionCreate = await Type_question.create(typequestionCreateObj);

            res.status(201).json(response(201, 'success create type question', typequestionCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate type question berdasarkan id
    updateTypeQuestion: async (req, res) => {
        try {
            //mendapatkan data type question untuk pengecekan
            let typequestionGet = await Type_question.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type question ada
            if (!typequestionGet) {
                res.status(404).json(response(404, 'type question not found'));
                return;
            }

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string",
                    optional: true
                },
            }

            //buat object type question
            let typequestionUpdateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typequestionUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //update type question
            await Type_question.update(typequestionUpdateObj, {
                where: {
                    id: req.params.id,
                }
            })

            //mendapatkan data type question setelah update
            let typequestionAfterUpdate = await Type_question.findOne({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success update type question', typequestionAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus type question berdasarkan id
    deleteTypeQuestion: async (req, res) => {
        try {

            //mendapatkan data type question untuk pengecekan
            let typequestionGet = await Type_question.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type question ada
            if (!typequestionGet) {
                res.status(404).json(response(404, 'type question not found'));
                return;
            }

            await Type_question.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete type question'));

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