'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User_info extends Model {
    static associate(models) {
      User_info.hasOne(models.User, {
        foreignKey: 'userinfo_id',
      });
      User_info.belongsTo(models.Provinsi, {
        foreignKey: 'provinsi_id',
      });
      User_info.belongsTo(models.Kota, {
        foreignKey: 'kota_id',
      });
    }
  }
  User_info.init({
    name: DataTypes.STRING,
    slug: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true,
    },
    telepon: DataTypes.STRING,
    alamat: DataTypes.STRING,
    provinsi_id: DataTypes.INTEGER,
    kota_id: DataTypes.INTEGER,
    tempat_lahir: DataTypes.STRING,
    tgl_lahir: DataTypes.DATEONLY,
    gender: DataTypes.SMALLINT,
    asal_instansi: DataTypes.STRING,
    image_profile: DataTypes.STRING,
    deletedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'User_info',
  });
  return User_info;
};