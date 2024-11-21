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
    no_payment: DataTypes.STRING,
    typepayment_id: DataTypes.INTEGER,
    price: DataTypes.STRING,
    receipt: DataTypes.STRING,
    status: DataTypes.BOOLEAN,
  }, {
    sequelize,
    modelName: 'Payment',
  });
  return Payment;
};