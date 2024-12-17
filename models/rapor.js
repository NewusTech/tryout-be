'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Rapor extends Model {
    static associate(models) {
      Rapor.belongsTo(models.User_info, {
        foreignKey: 'userinfo_id'
      });
    }
  }
  Rapor.init({
    rapor: DataTypes.STRING,
    userinfo_id: DataTypes.STRING,
    status: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Rapor',
  });
  return Rapor;
};