'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User_feedback extends Model {
    static associate(models) {
      User_feedback.belongsTo(models.User_info, {
        foreignKey: 'userinfo_id',
      });
      User_feedback.belongsTo(models.Package_tryout, {
        foreignKey: 'packagetryout_id',
      });
    }
  }
  User_feedback.init({
    userinfo_id: DataTypes.INTEGER,
    packagetryout_id: DataTypes.INTEGER,
    question_1: DataTypes.INTEGER,
    feedback: DataTypes.TEXT,
  }, {
    sequelize,
    modelName: 'User_feedback',
  });
  return User_feedback;
};