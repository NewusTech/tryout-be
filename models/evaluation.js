'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Evaluation extends Model {
    static associate(models) {
    }
  }
  Evaluation.init({
    note: DataTypes.TEXT,
    userinfo_id: DataTypes.INTEGER,
    tanggal: DataTypes.STRING,
    updatedBy: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Evaluation',
  });
  return Evaluation;
};