'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Bank_package extends Model {
    static associate(models) {
        Bank_package.belongsTo(models.Package_tryout, {
            foreignKey: 'packagetryout_id',
        });
        Bank_package.belongsTo(models.Bank_soal, {
            foreignKey: 'banksoal_id',
        });
        Bank_package.belongsTo(models.Package_tryout, {
          foreignKey: 'packagetryout_id', 
        });
    }
  }
  Bank_package.init({
    packagetryout_id: DataTypes.INTEGER,
    banksoal_id: DataTypes.INTEGER,
    deletedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Bank_package',
  });
  return Bank_package;
};