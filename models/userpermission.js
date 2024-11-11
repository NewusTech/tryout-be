'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User_permission extends Model {
    static associate(models) {
    }
  }
  User_permission.init({
    user_id: DataTypes.INTEGER,
    permission_id: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'User_permission',
  });
  return User_permission;
};