'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Setting_sertifikat extends Model {
    static associate(models) {
      Setting_sertifikat.belongsTo(models.Package_tryout, {
        foreignKey: 'packagetryout_id',
      });
    }
  }
  Setting_sertifikat.init({
    packagetryout_id: DataTypes.INTEGER,
    title: DataTypes.STRING,
    name: DataTypes.STRING,
    sign: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Setting_sertifikat',
  });
  return Setting_sertifikat;
};