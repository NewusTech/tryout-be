'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Bank_soal extends Model {
    static associate(models) {
        Bank_soal.belongsTo(models.Type_question, {
            foreignKey: 'typequestion_id',
        });
        Bank_soal.hasMany(models.Question_form, {
          foreignKey: 'banksoal_id',
        });
        
    }
  }
  Bank_soal.init({
    title: DataTypes.STRING,
    typequestion_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Bank_soal',
  });
  return Bank_soal;
};