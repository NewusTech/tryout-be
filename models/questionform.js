'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Question_form extends Model {
    static associate(models) {
      Question_form.belongsTo(models.Bank_soal, {
        foreignKey: 'banksoal_id',
      });
      // Question_form.belongsTo(models.Type_question, {
      //   foreignKey: 'typequestion_id',
      // });
      Question_form.hasMany(models.Question_form_input, {
        foreignKey: 'questionform_id',
      });
    }
  }
  Question_form.init({
    field: DataTypes.STRING,
    tipedata: DataTypes.STRING,
    datajson: DataTypes.JSON,
    banksoal_id: DataTypes.INTEGER,
    status: DataTypes.BOOLEAN,
    correct_answer: DataTypes.JSON,
    discussion: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Question_form',
  });
  return Question_form;
};