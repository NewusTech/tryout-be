const { response } = require("../helpers/response.formatter");

const { Provinsi } = require("../models");
const { generatePagination } = require("../pagination/pagination");
const Validator = require("fastest-validator");
const v = new Validator();
const { Op } = require("sequelize");

module.exports = {
    
  //get semua data provinsi
  getProvinsi: async (req, res) => {
    try {
      let provinsiGets;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = req.query.search ?? null;

      if (search) {
        [provinsiGets, totalCount] = await Promise.all([
          Provinsi.findAll({
            where: {
              nama: { [Op.like]: `%${search}%` },
            },
            limit: limit,
            offset: offset,
          }),
          Provinsi.count({
            where: {
              nama: { [Op.like]: `%${search}%` },
            },
          }),
        ]);
      } else {
        [provinsiGets, totalCount] = await Promise.all([
          Provinsi.findAll({
            limit: limit,
            offset: offset,
          }),
          Provinsi.count({}),
        ]);
      }

      const pagination = generatePagination(totalCount, page, limit, "/api/user/provinsi/get");

      res.status(200).json({
        status: 200,
        message: "success get provinsi",
        data: provinsiGets,
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //get data provinsi berdasarkan id
  getProvinsiById: async (req, res) => {
    try {
      let provinsiGet = await Provinsi.findOne({
        where: {
          id: req.params.id,
        },
      });

      if (!provinsiGet) {
        res.status(404).json(response(404, "provinsi not found"));
        return;
      }

      res.status(200).json(response(200, "success get provinsi by id", provinsiGet));
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },
};
