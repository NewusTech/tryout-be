const { response } = require('../helpers/response.formatter');

const { Role } = require('../models');
const Validator = require("fastest-validator");
const v = new Validator();

module.exports = {

    //membuat role
    createRole: async (req, res) => {
        try {

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string",
                    min: 3,
                },
            }

            //buat object role
            let roleCreateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(roleCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //buat role
            let roleCreate = await Role.create(roleCreateObj);

            res.status(201).json(response(201, 'success create role', roleCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan semua data role
    getRole: async (req, res) => {
        try {
            //mendapatkan data semua role
            let roleGets = await Role.findAll({});

            res.status(200).json(response(200, 'success get role', roleGets));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data role berdasarkan id
    getRoleById: async (req, res) => {
        try {
            //mendapatkan data role berdasarkan id
            let roleGet = await Role.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika role tidak ada
            if (!roleGet) {
                res.status(404).json(response(404, 'role not found'));
                return;
            }

            res.status(200).json(response(200, 'success get role by id', roleGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate role berdasarkan id
    updateRole: async (req, res) => {
        try {
            //mendapatkan data role untuk pengecekan
            let roleGet = await Role.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data role ada
            if (!roleGet) {
                res.status(404).json(response(404, 'role not found'));
                return;
            }

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string",
                    min: 3,
                    optional: true
                },
            }

            //buat object role
            let roleUpdateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(roleUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //update role
            await Role.update(roleUpdateObj, {
                where: {
                    id: req.params.id,
                }
            })

            //mendapatkan data role setelah update
            let roleAfterUpdate = await Role.findOne({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success update role', roleAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus role berdasarkan id
    deleteRole: async (req, res) => {
        try {

            //mendapatkan data role untuk pengecekan
            let roleGet = await Role.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data role ada
            if (!roleGet) {
                res.status(404).json(response(404, 'role not found'));
                return;
            }

            await Role.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete role'));

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