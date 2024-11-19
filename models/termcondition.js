'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Term_condition extends Model {
    static associate(models) {
    }
  }
  Term_condition.init({
    term_condition: DataTypes.TEXT,
    privacy_policy: DataTypes.TEXT,
  }, {
    sequelize,
    modelName: 'Term_condition',
  });
  return Term_condition;
};