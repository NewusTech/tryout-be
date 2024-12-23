'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Evaluation extends Model {
    static associate(models) {
      // Evaluation.belongsTo(models.User_info, {
      //   foreignKey: 'userinfo_id'
      // });
    }
  }
  Evaluation.init({
    note: DataTypes.TEXT,
    userinfo_id: DataTypes.STRING,
    tanggal: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Evaluation',
  });
  return Evaluation;
};