const { response } = require('../helpers/response.formatter');

const { Kota } = require('../models');
const { generatePagination } = require('../pagination/pagination');
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require('sequelize');

module.exports = {

    //mendapatkan semua data kota
    getKota: async (req, res) => {
        try {
            let kotaGets;
            const search = req.query.search ?? null;
            const provinsi_id = req.query.provinsi_id ?? null;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            let totalCount;

            let filter = {};

            if (search) {
                filter.name = { [Op.like]: `%${search}%` };
            }
    
            if (provinsi_id) {
                filter.provinsi_id = provinsi_id;
            }

            [kotaGets, totalCount] = await Promise.all([
                Kota.findAll({
                    where: filter,
                    limit: limit,
                    offset: offset
                }),
                Kota.count({
                    where: filter,
                })
            ]);

            const pagination = generatePagination(totalCount, page, limit, '/api/user/kota/get');

            res.status(200).json({
                status: 200,
                message: 'success get kota',
                data: kotaGets,
                pagination: pagination
            });

        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },

    //mendapatkan data kota berdasarkan id
    getKotaById: async (req, res) => {
        try {
            //mendapatkan data kota berdasarkan id
            let kotaGet = await Kota.findOne({
                where: {
                    id: req.params.id
                },
            });

            //cek jika kota tidak ada
            if (!kotaGet) {
                res.status(404).json(response(404, 'kota not found'));
                return;
            }

            //response menggunakan helper response.formatter
            res.status(200).json(response(200, 'success get kota by id', kotaGet));
        } catch (err) {
            res.status(500).json(response(500, 'internal server error', err));
            console.log(err);
        }
    },
}