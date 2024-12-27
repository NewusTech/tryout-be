'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Banner_program extends Model {
    static associate(models) {
    }
  }
  Banner_program.init({
    image: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Banner_program',
  });
  return Banner_program;
};