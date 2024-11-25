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
      Payment.belongsTo(models.User_info, {
        foreignKey: 'userinfo_id',
      });
    }
  }
  
  Payment.init({
    userinfo_id: DataTypes.INTEGER,
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