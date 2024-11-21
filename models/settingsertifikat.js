'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Setting_sertifikat extends Model {
    static associate(models) {
      
    }
  }
  Setting_sertifikat.init({
    title: DataTypes.STRING,
    name: DataTypes.STRING,
    sign: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Setting_sertifikat',
  });
  return Setting_sertifikat;
};