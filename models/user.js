'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Role, {
        foreignKey: 'role_id',
      });
      User.belongsTo(models.User_info, {
        foreignKey: 'userinfo_id',
      });
      User.belongsTo(models.Type_user, {
        foreignKey: 'typeuser_id',
      });
      User.belongsTo(models.Payment, {
        foreignKey: 'payment_id',
      });
      User.belongsToMany(models.Permission, {
        through: 'User_permissions',
        as: 'permissions',
        foreignKey: 'user_id'
      });
      User.belongsTo(models.Package_tryout, {
        foreignKey: 'packagetryout_id',
      });
    }
  }
  User.init({
    password: DataTypes.STRING,
    slug: DataTypes.STRING,
    typeuser_id: DataTypes.INTEGER,
    role_id: DataTypes.INTEGER,
    userinfo_id: DataTypes.INTEGER,
    payment_id: DataTypes.INTEGER,
    packagetryout_id: DataTypes.INTEGER,
    deletedAt: DataTypes.DATE,
    resetpasswordtoken: DataTypes.STRING,
    resetpasswordexpires: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};