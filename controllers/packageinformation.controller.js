const { response } = require("../helpers/response.formatter");
const { Package_information, Package_fitur } = require("../models");
const Validator = require("fastest-validator");
const v = new Validator();
const { Op, Sequelize } = require("sequelize");
const { generatePagination } = require("../pagination/pagination");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  useAccelerateEndpoint: true,
});

module.exports = {
  
  //membuat program
  createPackageInformation : async (req, res) => {
  try {
    const { name, price, duration, description, fitur } = req.body;

    // validasi input
    if (!name || !price || !duration || !description) {
      return res.status(400).json({ status: 400, message: "All fields are required" });
    }

    if (!Array.isArray(fitur) || fitur.length === 0) {
      return res.status(400).json({ status: 400, message: "Fitur must be an array and cannot be empty" });
    }

    // create Package
    const newPackage = await Package_information.create({
      name,
      price,
      duration,
      description,
    });

    const fiturData = fitur.map((fiturName) => ({
      packageinformation_id: newPackage.id, // relasi dengan id package fitur
      fitur: fiturName,
    }));

    await Package_fitur.bulkCreate(fiturData);

    return res.status(201).json({
      status: 201,
      message: "Package created successfully",
      data: {
        id: newPackage.id,
        name: newPackage.name,
        price: newPackage.price,
        duration: newPackage.duration,
        description: newPackage.description,
        fitur,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
   }
  },

  //mendapatkan semua data package information
  getPackageInformation: async (req, res) => {
    try {
      let packageInformationGet = await Package_information.findAll({
        include: [
          {
            model: Package_fitur,
            attributes: ['id', 'fitur'],
          },
        ],
        order: [['id', 'ASC']],
      });
  
      // Format data untuk response
      const formattedData = packageInformationGet.map((packageinformations) => ({
        id: packageinformations.id,
        name: packageinformations.name,
        price: packageinformations.price,
        duration: packageinformations.duration,
        description: packageinformations.description,
        fitur: packageinformations.Package_fiturs.map((f) => f.fitur), 
      }));
  
      if (formattedData.length === 0) {
        return res.status(404).json({
          code: 404,
          message: "Package information not found",
          data: [],
        });
      }

      return res.status(200).json({
        code: 200,
        message: "Success get package information",
        data: formattedData,
      });
    } catch (err) {
      console.error("Error:", err.message);
      return res.status(500).json({
        code: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },
  
  //mendapatkan data package information berdasarkan id
  getPackageInformationById: async (req, res) => {
    try {

      const packageInformationGet = await Package_information.findOne({
        where: {
          id: req.params.id,
        },
        include: [
          {
            model: Package_fitur,
            attributes: ['fitur'], 
          },
        ],
      });
  
      if (!packageInformationGet) {
        return res.status(404).json({
          code: 404,
          message: "Package information by id not found",
          data: null,
        });
      }
  
      // format data untuk response
      const formattedData = {
        id: packageInformationGet.id,
        name: packageInformationGet.name,
        price: packageInformationGet.price,
        duration: packageInformationGet.duration,
        description: packageInformationGet.description,
        fitur: packageInformationGet.Package_fiturs.map((f) => f.fitur), 
      };
  
      return res.status(200).json({
        code: 200,
        message: "Success get package information by id",
        data: formattedData,
      });
    } catch (err) {
      console.error("Error:", err.message);
      return res.status(500).json({
        code: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },
  
  //mengupdate package information berdasarkan id
  updatePackageInformation: async (req, res) => {
    try {
      const { name, price, duration, description, fitur } = req.body;
  
      // Cari data package berdasarkan ID
      const packageInformation = await Package_information.findOne({
        where: { id: req.params.id },
        include: [{ model: Package_fitur, attributes: ['id', 'fitur'] }],
      });
  
      // Jika data tidak ditemukan
      if (!packageInformation) {
        return res.status(404).json({
          status: 404,
          message: "Package information not found",
        });
      }
  
      // Validasi input
      if (!name && !price && !duration && !description && !fitur) {
        return res.status(400).json({
          status: 400,
          message: "At least one field is required for update",
        });
      }
  
      if (fitur && (!Array.isArray(fitur) || fitur.length === 0)) {
        return res.status(400).json({
          status: 400,
          message: "Fitur must be an array and cannot be empty if provided",
        });
      }
  
      // Update data package information
      await Package_information.update(
        { name, price, duration, description },
        { where: { id: req.params.id } }
      );
  
      // Update fitur jika ada
      if (fitur) {
        // Hapus fitur lama
        await Package_fitur.destroy({
          where: { packageinformation_id: packageInformation.id },
        });
  
        // Tambahkan fitur baru
        const fiturData = fitur.map((fiturName) => ({
          packageinformation_id: packageInformation.id,
          fitur: fiturName,
        }));
        await Package_fitur.bulkCreate(fiturData);
      }
  
      // Ambil data terbaru setelah update
      const updatedPackageInformation = await Package_information.findOne({
        where: { id: req.params.id },
        include: [{ model: Package_fitur, attributes: ['fitur'] }],
      });
  
      return res.status(200).json({
        status: 200,
        message: "Success update package information",
        data: {
          id: updatedPackageInformation.id,
          name: updatedPackageInformation.name,
          price: updatedPackageInformation.price,
          duration: updatedPackageInformation.duration,
          description: updatedPackageInformation.description,
          fitur: updatedPackageInformation.Package_fiturs.map((f) => f.fitur),
        },
      });
    } catch (err) {
      console.error("Error:", err.message);
      return res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },
  
  
  

  //menghapus package information berdasarkan id
  deletePackageInformation: async (req, res) => {
    try {
      const packageInformation = await Package_information.findOne({
        where: { id: req.params.id },
        include: [{ model: Package_fitur }],
      });
  
      // jika data tidak ditemukan
      if (!packageInformation) {
        return res.status(404).json({
          status: 404,
          message: "Package information not found",
        });
      }
  
      // hapus fitur yang terkait dengan package
      await Package_fitur.destroy({
        where: { packageinformation_id: packageInformation.id },
      });

      await Package_information.destroy({
        where: { id: req.params.id },
      });
  
      return res.status(200).json({
        status: 200,
        message: "Package information deleted successfully",
      });
    } catch (err) {
      console.error("Error:", err.message);
      return res.status(500).json({
        status: 500,
        message: "Internal server error",
        error: err.message,
      });
    }
  },
  
  
};
