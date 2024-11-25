'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Question_form_num extends Model {
    static associate(models) {
      Question_form_num.belongsTo(models.Package_tryout, {
        foreignKey: 'packagetryout_id',
      });
      Question_form_num.hasMany(models.Question_form_input, {
        foreignKey: 'questionformnum_id',
      });
      Question_form_num.belongsTo(models.User_info, {
        foreignKey: 'userinfo_id',
      });
    }
  }
  Question_form_num.init({
    no_ujian: DataTypes.STRING,
    userinfo_id: DataTypes.INTEGER,
    packagetryout_id: DataTypes.INTEGER,
    sertifikat: DataTypes.STRING,
    skor: DataTypes.STRING,
    tgl_selesai: DataTypes.DATEONLY,
    status: DataTypes.SMALLINT,
  }, {
    sequelize,
    modelName: 'Question_form_num',
  });
  return Question_form_num;
};