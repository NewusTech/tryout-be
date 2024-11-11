'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Type_question extends Model {
    static associate(models) {
    }
  }
  Type_question.init({
    name: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Type_question',
  });
  return Type_question;
};