'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Question_form_input extends Model {
    static associate(models) {
      Question_form_input.belongsTo(models.Question_form, {
        foreignKey: 'questionform_id',
      });
      Question_form_input.belongsTo(models.Question_form_num, {
        foreignKey: 'questionformnum_id',
      });
    }
  }
  Question_form_input.init({
    data: DataTypes.STRING,
    questionform_id: DataTypes.INTEGER,
    questionformnum_id: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Question_form_input',
  });
  return Question_form_input;
};