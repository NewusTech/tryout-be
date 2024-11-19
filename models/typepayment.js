'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Type_payment extends Model {
    static associate(models) {
    }
  }
  Type_payment.init({
    title: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Type_payment',
  });
  return Type_payment;
};