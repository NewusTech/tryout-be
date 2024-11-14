const { response } = require('../helpers/response.formatter');

const { Type_package } = require('../models');
const { generatePagination } = require('../pagination/pagination');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require('sequelize');

module.exports = {

    //mendapatkan semua data type package
    getTypePackage: async (req, res) => {
        try {
            let typepackageGets;
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

            [typepackageGets, totalCount] = await Promise.all([
                Type_package.findAll({
                    where: filter,
                    limit: limit,
                    offset: offset
                }),
                Type_package.count({
                    where: filter,
                })
            ]);

            const pagination = generatePagination(totalCount, page, limit, '/api/user/type/package/get');

            res.status(200).json({
                status: 200,
                message: 'success get type package',
                data: typepackageGets,
                pagination: pagination
            });

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data type package berdasarkan id
    getTypePackageById: async (req, res) => {
        try {
            //mendapatkan data type package berdasarkan id
            let typepackageGet = await Type_package.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika type package tidak ada
            if (!typepackageGet) {
                res.status(404).json(response(404, 'type package not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get type package by id', typepackageGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //create data type package
    createTypePackage: async (req, res) => {
        try {

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string"
                },
            }

            //buat object tipe package
            let typepackageCreateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typepackageCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //buat typepackage
            let typepackageCreate = await Type_package.create(typepackageCreateObj);

            res.status(201).json(response(201, 'success create type package', typepackageCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate type package berdasarkan id
    updateTypePackage: async (req, res) => {
        try {
            //mendapatkan data type package untuk pengecekan
            let typepackageGet = await Type_package.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type package ada
            if (!typepackageGet) {
                res.status(404).json(response(404, 'type package not found'));
                return;
            }

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string",
                    optional: true
                },
            }

            //buat object type package
            let typepackageUpdateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(typepackageUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //update typepackage
            await Type_package.update(typepackageUpdateObj, {
                where: {
                    id: req.params.id,
                }
            })

            //mendapatkan data type package setelah update
            let typepackageAfterUpdate = await Type_package.findOne({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success update type package', typepackageAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus type package berdasarkan id
    deleteTypePackage: async (req, res) => {
        try {

            //mendapatkan data type package untuk pengecekan
            let typepackageGet = await Type_package.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data type package ada
            if (!typepackageGet) {
                res.status(404).json(response(404, 'type package not found'));
                return;
            }

            await Type_package.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete type package'));

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