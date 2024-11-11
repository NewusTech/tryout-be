const { response } = require('../helpers/response.formatter');

const { Permission } = require('../models');
const Validator = require("fastest-validator");
const v = new Validator();

module.exports = {

    //membuat permission
    createPermission: async (req, res) => {
        try {

            //membuat schema untuk validasi
            const schema = {
                name: {
                    type: "string",
                    min: 3,
                },
            }

            //buat object permission
            let permissionCreateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(permissionCreateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //buat permission
            let permissionCreate = await Permission.create(permissionCreateObj);

            res.status(201).json(response(201, 'success create permission', permissionCreate));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan semua data permission
    getPermission: async (req, res) => {
        try {
            //mendapatkan data semua permission
            let permissionGets = await Permission.findAll({
                order: [['id', 'ASC']]
            });

            res.status(200).json(response(200, 'success get permission', permissionGets));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data permission berdasarkan id
    getPermissionById: async (req, res) => {
        try {
            //mendapatkan data permission berdasarkan id
            let permissionGet = await Permission.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika permission tidak ada
            if (!permissionGet) {
                res.status(404).json(response(404, 'permission not found'));
                return;
            }

            res.status(200).json(response(200, 'success get permission by id', permissionGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mengupdate permission berdasarkan id
    updatePermission: async (req, res) => {
        try {
            //mendapatkan data permission untuk pengecekan
            let permissionGet = await Permission.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data permission ada
            if (!permissionGet) {
                res.status(404).json(response(404, 'permission not found'));
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

            //buat object permission
            let permissionUpdateObj = {
                name: req.body.name,
            }

            //validasi menggunakan module fastest-validator
            const validate = v.validate(permissionUpdateObj, schema);
            if (validate.length > 0) {
                res.status(400).json(response(400, 'validation failed', validate));
                return;
            }

            //update permission
            await Permission.update(permissionUpdateObj, {
                where: {
                    id: req.params.id,
                }
            })

            //mendapatkan data permission setelah update
            let permissionAfterUpdate = await Permission.findOne({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success update permission', permissionAfterUpdate));

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //menghapus permission berdasarkan id
    deletePermission: async (req, res) => {
        try {

            //mendapatkan data permission untuk pengecekan
            let permissionGet = await Permission.findOne({
                where: {
                    id: req.params.id
                }
            })

            //cek apakah data permission ada
            if (!permissionGet) {
                res.status(404).json(response(404, 'permission not found'));
                return;
            }

            await Permission.destroy({
                where: {
                    id: req.params.id,
                }
            })

            res.status(200).json(response(200, 'success delete permission'));

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