'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Schedule extends Model {
    static associate(models) {
      Schedule.belongsTo(models.Package_tryout, {
        foreignKey: 'packagetryout_id',
      });
      Schedule.hasMany(models.Question_form_num, {
        foreignKey: 'schedule_id',
      });
    }
  }

  Schedule.init({
    title: DataTypes.STRING,
    packagetryout_id: DataTypes.INTEGER,
    tanggal: DataTypes.DATEONLY,
    waktu: DataTypes.TIME,
    deletedAt: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Schedule',
  });

  return Schedule;
};