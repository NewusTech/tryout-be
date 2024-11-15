const { response } = require('../helpers/response.formatter');

const { Type_user } = require('../models');
const { generatePagination } = require('../pagination/pagination');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require('sequelize');

module.exports = {

    //mendapatkan semua data type user
    getTypeUser: async (req, res) => {
        try {
            let typeuserGets;
            const search = req.query.search ?? null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let totalCount;

            let filter = {};

            if (search) {
                filter.name = { [Op.like]: `%${search}%` };
            }

            [typeuserGets, totalCount] = await Promise.all([
                Type_user.findAll({
                    where: filter,
                    limit: limit,
                    offset: offset
                }),
                Type_user.count({
                    where: filter,
                })
            ]);

            const pagination = generatePagination(totalCount, page, limit, '/api/user/type/user/get');

            res.status(200).json({
                status: 200,
                message: 'success get type user',
                data: typeuserGets,
                pagination: pagination
            });

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data type user berdasarkan id
    getTypeUserById: async (req, res) => {
        try {
            //mendapatkan data type user berdasarkan id
            let typeuserGet = await Type_user.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika type user tidak ada
            if (!typeuserGet) {
                res.status(404).json(response(404, 'Type user not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'Success get type user by id', typeuserGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //create data type user
    createTypeUser: async (req, res) => {
        try {

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string"
                },
            }

            //buat object tipe user
            let typeuserCreateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typeuserCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //buat typeuser
            let typeuserCreate = await Type_user.create(typeuserCreateObj);

            res.status(201).json(response(201, 'Success create type user', typeuserCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate type user berdasarkan id
    updateTypeUser: async (req, res) => {
        try {
            //mendapatkan data type user untuk pengecekan
            let typeuserGet = await Type_user.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type user ada
            if (!typeuserGet) {
                res.status(404).json(response(404, 'type user not found'));
                return;
            }

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string",
                    optional: true
                },
            }

            //buat object type user
            let typeuserUpdateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typeuserUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //update typeuser
            await Type_user.update(typeuserUpdateObj, {
                where: {
                    id: req.params.id,
                }
            })

            //mendapatkan data type user setelah update
            let typeuserAfterUpdate = await Type_user.findOne({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success update type user', typeuserAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus type user berdasarkan id
    deleteTypeUser: async (req, res) => {
        try {

            //mendapatkan data type user untuk pengecekan
            let typeuserGet = await Type_user.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type user ada
            if (!typeuserGet) {
                res.status(404).json(response(404, 'type user not found'));
                return;
            }

            await Type_user.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'Success delete type user'));

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