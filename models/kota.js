'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Kota extends Model {
    static associate(models) {
      Kota.hasMany(models.User_info, {
        foreignKey: 'kota_id',
      });
    }
  }
  Kota.init({
    name: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Kota',
  });
  return Kota;
};