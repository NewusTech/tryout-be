'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Package_information extends Model {
    static associate(models) {
      Package_information.hasMany(models.Package_fitur, {
        foreignKey: 'packageinformation_id',
      });
    }
  }
  Package_information.init({
    name: DataTypes.STRING,
    price: DataTypes.STRING,
    duration: DataTypes.STRING,
    description: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Package_information',
  });
  return Package_information;
};