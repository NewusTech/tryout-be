'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Type_user extends Model {
    static associate(models) {
    }
  }
  Type_user.init({
    name: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Type_user',
  });
  return Type_user;
};