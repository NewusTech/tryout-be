'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Social_media extends Model {
    static associate(models) {
    }
  }
  Social_media.init({
    title: DataTypes.STRING,
    link: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Social_media',
  });
  return Social_media;
};