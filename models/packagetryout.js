'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Package_tryout extends Model {
    static associate(models) {
        Package_tryout.hasMany(models.User, {
            foreignKey: 'packagetryout_id',
        });
        Package_tryout.belongsTo(models.Type_package, {
            foreignKey: 'typepackage_id',
        });
        Package_tryout.hasMany(models.Question_form, {
            foreignKey: 'packagetryout_id',
        });
        Package_tryout.hasMany(models.Question_form_num, {
            foreignKey: 'packagetryout_id',
        });
    }
  }
  Package_tryout.init({
    title: DataTypes.STRING,
    slug: DataTypes.STRING,
    description: DataTypes.TEXT,
    duration: DataTypes.STRING,
    price: DataTypes.STRING,
    typepackage_id: DataTypes.INTEGER,
    total_question: DataTypes.STRING,
    deletedAt: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Package_tryout',
  });
  return Package_tryout;
};