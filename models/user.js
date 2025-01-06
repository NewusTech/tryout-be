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
      User.belongsTo(models.Type_package, {
        foreignKey: 'typepackage_id',
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
    typepackage_id: DataTypes.INTEGER,
    role_id: DataTypes.INTEGER,
    userinfo_id: DataTypes.INTEGER,
    payment_id: DataTypes.INTEGER,
    packagetryout_id: DataTypes.INTEGER,
    deletedAt: DataTypes.DATE,
    resetpasswordtoken: DataTypes.STRING,
    resetpasswordexpires: DataTypes.DATE,
    verification_token: DataTypes.STRING,
    isVerified: DataTypes.BOOLEAN,
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};