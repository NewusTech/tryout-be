'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Type_package extends Model {
    static associate(models) {
      Type_package.hasMany(models.User, {
        foreignKey: 'typepackage_id',
    });
    }
  }
  Type_package.init({
    name: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Type_package',
  });
  return Type_package;
};