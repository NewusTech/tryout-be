'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Type_payment, {
        foreignKey: 'typepayment_id',
      });
    }
  }
  
  Payment.init({
    typepayment_id: DataTypes.INTEGER,
    price: DataTypes.STRING,
    receipt: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Payment',
  });
  return Payment;
};