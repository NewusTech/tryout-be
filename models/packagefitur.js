'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Package_fitur extends Model {
    static associate(models) {
      Package_fitur.belongsTo(models.Package_information, {
        foreignKey: 'packageinformation_id',
      });
    }
  }
  Package_fitur.init({
    packageinformation_id: DataTypes.INTEGER,
    fitur: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Package_fitur',
  });
  return Package_fitur;
};