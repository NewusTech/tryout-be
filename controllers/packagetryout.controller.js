const { response } = require("../helpers/response.formatter");
const {
  Package_tryout,
  Type_package,
  Type_question,
  Bank_package,
  Bank_soal,
  User,
  User_info,
  Role,
  sequelize,
} = require("../models");
require("dotenv").config();
const slugify = require("slugify");
const Validator = require("fastest-validator");
const v = new Validator();
const fs = require("fs");
const path = require("path");
const { generatePagination } = require("../pagination/pagination");
const { Op, Sequelize } = require("sequelize");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const logger = require("../errorHandler/logger");
const { duration } = require("moment-timezone");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  useAccelerateEndpoint: true,
});

module.exports = {
  //membuat paket tryout
  createPackage: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const schema = {
        title: { type: "string" },
        description: { type: "string", optional: true },
        duration: { type: "string", optional: true },
        price: { type: "string", optional: true },
        typepackage_id: { type: "number", optional: true },
        total_question: { type: "string", optional: true },
        banksoals: { type: "array", optional: true },
      };

      let packageCreateObj = {
        title: req.body.title,
        slug: slugify(req.body.title, { lower: true }),
        description: req.body.description,
        duration: req.body.duration,
        price: req.body.price,
        total_question: req.body.total_question,
        typepackage_id:
          req.body.typepackage_id !== undefined
            ? Number(req.body.typepackage_id)
            : null,
      };

      // Validasi input
      const validate = v.validate(packageCreateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "Validation failed", validate));
        return;
      }

      // Cek apakah slug sudah terdaftar
      let dataGets = await Package_tryout.findOne({
        where: {
          slug: packageCreateObj.slug,
          deletedAt: null,
        },
      });
      if (dataGets) {
        res.status(409).json(response(409, "Slug already registered"));
        return;
      }

      // Buat paket tryout
      let packageCreate = await Package_tryout.create(packageCreateObj, {
        transaction,
      });

      if (req.body.banksoals && Array.isArray(req.body.banksoals)) {
        for (let banksoal of req.body.banksoals) {
          await Bank_package.create(
            {
              packagetryout_id: packageCreate.id,
              banksoal_id: banksoal.id,
            },
            { transaction }
          );
        }
      }

      // Commit transaksi
      await transaction.commit();

      // Response menggunakan helper response.formatter
      res
        .status(201)
        .json(
          response(201, "Successfully created package tryout", packageCreate)
        );
    } catch (err) {
      await transaction.rollback();
      res.status(500).json(response(500, "Internal server error", err));
      console.log(err);
    }
  },

  //get semua data paket tryout
  getPackageTryout: async (req, res) => {
    try {
      const search = req.query.search ?? null;
      const packagetryout_id = req.query.packagetryout_id ?? null;
      const showDeleted = req.query.showDeleted === "true";
      const month = parseInt(req.query.month) || null;
      const year = parseInt(req.query.year) || null;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const isSuperAdmin = req.user.role === "Super Admin";
      const userinfo_id = req.user.role === "User" ? req.user.userId : null;

      if (!isSuperAdmin && !userinfo_id) {
        return res.status(403).json({
          code: 403,
          message:
            "Forbidden: Only authenticated users can access this resource",
          data: null,
        });
      }

      const whereCondition = {};

      //jika user biasa, tambahkan filter typepackage dan isEvent
      if (!isSuperAdmin) {
        // Ambil informasi role dan type_package pengguna yang sedang login
        const user = await User_info.findOne({
          where: { id: userinfo_id },
          include: [
            {
              model: User,
              attributes: ["id", "typepackage_id", "role_id"],
              include: [
                {
                  model: Role,
                  attributes: ["name"],
                },
                {
                  model: Type_package,
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        });

        if (!user) {
          return res.status(404).json({
            status: 404,
            message: "User not found",
          });
        }

        const typePackageId = user.User.typepackage_id;
        whereCondition.typepackage_id = typePackageId;

        whereCondition.isEvent = {
          [Op.or]: [0, null],
        };
      }

      //filter berdasarkan packagetryout_id jika tersedia
      if (packagetryout_id) {
        whereCondition.id = packagetryout_id;
      }

      //filter pencarian berdasarkan title
      if (search) {
        whereCondition[Op.or] = [
          {
            title: { [Op.like]: `%${search}%` },
          },
        ];
      }

      //filter showDeleted untuk menampilkan data yang sudah dihapus
      if (showDeleted) {
        whereCondition.deletedAt = { [Op.not]: null };
      } else {
        whereCondition.deletedAt = null;
      }

      //filter berdasarkan bulan dan tahun (berdasarkan createdAt)
      if (month && year) {
        whereCondition.createdAt = {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("MONTH", Sequelize.col("Package_tryout.createdAt")),
              month
            ),
            Sequelize.where(
              Sequelize.fn("YEAR", Sequelize.col("Package_tryout.createdAt")),
              year
            ),
          ],
        };
      } else if (year) {
        whereCondition.createdAt = Sequelize.where(
          Sequelize.fn("YEAR", Sequelize.col("Package_tryout.createdAt")),
          year
        );
      }

      //get data paket tryout dan jumlah total
      const [packageGets, totalCount] = await Promise.all([
        Package_tryout.findAll({
          where: whereCondition,
          include: [
            {
              model: Type_package,
              attributes: ["id", "name"],
            },
          ],
          limit: limit,
          offset: offset,
          order: [["id", "ASC"]],
        }),
        Package_tryout.count({
          where: whereCondition,
        }),
      ]);

      const modifiedPackageGets = packageGets.map((package) => {
        const { Type_package, ...otherData } = package.dataValues;
        return {
          ...otherData,
          Type_package_name: Type_package?.name,
        };
      });

      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        "/api/user/package/get"
      );

      res.status(200).json({
        status: 200,
        message: "success get package tryout",
        data: modifiedPackageGets,
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: "internal server error",
        error: err.message,
      });
      console.log(err);
      logger.error(`Error : ${err}`);
      logger.error(`Error message: ${err.message}`);
    }
  },

  //get semua data paket tryout by type
  getPackageByType: async (req, res) => {
    try {
      const typepackage_id = req.params.typepackage_id;
      const showDeleted = req.query.showDeleted === "true" ?? false;
      let { search } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      let typeGets;
      let packageGets;
      let totalCount;

      let includeOptions = [
        { model: Type_package, attributes: ["id", "name"] },
      ];

      const whereCondition = {
        typepackage_id: typepackage_id,
      };

      // if (data?.role === "Admin Instansi" || data?.role === "Super Admin" || data?.role === "Bupati" || data?.role === "Admin Verifikasi") {
      // } else {
      //     whereCondition.status = true;
      // }

      if (search) {
        whereCondition[Op.and] = [{ name: { [Op.like]: `%${search}%` } }];
      }

      if (showDeleted) {
        whereCondition.deletedAt = { [Op.not]: null };
      } else {
        whereCondition.deletedAt = null;
      }

      [typeGets, packageGets, totalCount] = await Promise.all([
        Type_package.findOne({
          where: {
            id: typepackage_id,
          },
        }),
        Package_tryout.findAll({
          where: whereCondition,
          include: includeOptions,
          limit: limit,
          offset: offset,
          order: [["title"], ["id", "ASC"]],
        }),
        Package_tryout.count({
          where: whereCondition,
          include: includeOptions,
          distinct: true,
        }),
      ]);

      const modifiedPackageGets = packageGets.map((package) => {
        const { Type_package, ...otherData } = package.dataValues;
        return {
          ...otherData,
          Type_package_name: Type_package?.name,
        };
      });

      const pagination = generatePagination(
        totalCount,
        page,
        limit,
        `/api/user/package/type/get/${typepackage_id}`
      );

      res.status(200).json({
        status: 200,
        message: "success get paket tryout by tipe",
        data: modifiedPackageGets,
        type: typeGets,
        pagination: pagination,
      });
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //get data paket tryout berdasarkan id
  getPackageById: async (req, res) => {
    try {
      const showDeleted = req.query.showDeleted ?? null;
      const whereCondition = { id: req.params.id };

      if (showDeleted !== null) {
        whereCondition.deletedAt = { [Op.not]: null };
      } else {
        whereCondition.deletedAt = null;
      }

      let packageGet = await Package_tryout.findOne({
        where: whereCondition,
        include: [
          {
            model: Bank_package,
            attributes: ["id", "packagetryout_id", "banksoal_id"],
            include: [
              {
                model: Bank_soal,
                attributes: ["id", "title", "typequestion_id"],
                include: [
                  {
                    model: Type_question,
                    attributes: ["name"],
                  },
                ],
              },
            ],
          },
        ],
      });

      //cek jika paket tryout tidak ada
      if (!packageGet) {
        res.status(404).json(response(404, "package tryout not found"));
        return;
      }

      const { Type_package: typeObj, ...otherData } = packageGet.dataValues;
      const modifiedPackageGet = {
        ...otherData,
        type_name: typeObj?.name,
      };
      res
        .status(200)
        .json(
          response(200, "success get package tryout by id", modifiedPackageGet)
        );
    } catch (err) {
      res.status(500).json(response(500, "internal server error", err));
      console.log(err);
    }
  },

  //update paket berdasarkan id
  updatePackage: async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      // Validasi input schema
      const schema = {
        title: { type: "string" },
        description: { type: "string", optional: true },
        duration: { type: "string", optional: true },
        price: { type: "string", optional: true },
        typepackage_id: { type: "number", optional: true },
        total_question: { type: "string", optional: true },
        banksoal: { type: "array", optional: true },
      };

      let packageUpdateObj = {
        title: req.body.title,
        slug: req.body.title
          ? slugify(req.body.title, { lower: true })
          : undefined,
        description: req.body.description,
        duration: req.body.duration,
        price: req.body.price,
        total_question: req.body.total_question,
        typepackage_id:
          req.body.typepackage_id !== undefined
            ? Number(req.body.typepackage_id)
            : null,
      };

      // Validasi input menggunakan Validator
      const validate = v.validate(packageUpdateObj, schema);
      if (validate.length > 0) {
        res.status(400).json(response(400, "Validation failed", validate));
        return;
      }

      // Periksa apakah package ada
      const packageGet = await Package_tryout.findOne({
        where: {
          id: req.params.id,
          deletedAt: null,
        },
      });
      if (!packageGet) {
        res.status(404).json(response(404, "Package not found"));
        return;
      }

      // Periksa apakah slug sudah digunakan (jika title diubah)
      if (req.body.title) {
        const existingSlug = await Package_tryout.findOne({
          where: {
            slug: packageUpdateObj.slug,
            deletedAt: null,
            id: { [Op.ne]: req.params.id }, // Pastikan bukan dari package yang sedang diupdate
          },
        });
        if (existingSlug) {
          res.status(409).json(response(409, "Slug already registered"));
          return;
        }
      }

      // Update package
      await Package_tryout.update(packageUpdateObj, {
        where: {
          id: req.params.id,
        },
        transaction,
      });

      // Update banksoals jika ad
      if (req.body.banksoals && Array.isArray(req.body.banksoals)) {
        // Hapus relasi banksoal lama
        await Bank_package.destroy({
          where: {
            packagetryout_id: req.params.id,
          },
          transaction,
        });

        // Tambahkan relasi banksoal baru
        for (let banksoal of req.body.banksoals) {
          await Bank_package.create(
            {
              packagetryout_id: req.params.id,
              banksoal_id: banksoal.id,
            },
            { transaction }
          );
        }
      }

      // Ambil data package setelah update
      const packageAfterUpdate = await Package_tryout.findOne({
        where: {
          id: req.params.id,
        },
        include: [
          {
            model: Bank_package,
            include: [{ model: Bank_soal }],
          },
        ],
      });

      // Commit transaksi
      await transaction.commit();

      // Response sukses
      res
        .status(200)
        .json(
          response(
            200,
            "Successfully updated package tryout",
            packageAfterUpdate
          )
        );
    } catch (err) {
      // Rollback transaksi jika terjadi error
      await transaction.rollback();
      res.status(500).json(response(500, "Internal server error", err));
      console.log(err);
    }
  },

  //menghapus paket tryout
  deletePackage: async (req, res) => {
    try {
      let packageGet = await Package_tryout.findOne({
        where: {
          id: req.params.id,
          deletedAt: null,
        },
      });
      if (!packageGet) {
        res.status(404).json(response(404, "package not found"));
        return;
      }

      await Package_tryout.update(
        { deletedAt: new Date() },
        {
          where: {
            id: req.params.id,
          },
        }
      );

      res.status(200).json(response(200, "success delete package tryout"));
    } catch (err) {
      res.status(500).json(response(500, "Internal server error", err));
      console.log(err);
    }
  },
};
