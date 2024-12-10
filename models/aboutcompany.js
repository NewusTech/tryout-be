'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class About_company extends Model {
    static associate(models) {
    }
  }
  About_company.init({
    title: DataTypes.STRING,
    sub_title: DataTypes.STRING,
    description: DataTypes.TEXT,
    telepon: DataTypes.STRING,
    email: DataTypes.STRING,
    address: DataTypes.STRING,
    lat: DataTypes.STRING,
    long: DataTypes.STRING,
    main_logo: DataTypes.STRING,
    sub_logo: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'About_company',
  });
  return About_company;
};