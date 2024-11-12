const questionformInput = require('../controllers/questionforminput.controller.js');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.get('/user/history/tryout', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformInput.getHistoryFormUser);
route.get('/user/history/tryout/:idquestion_num', [mid.checkRolesAndLogout([ 'Super Admin', 'User'])], questionformInput.getHistoryById);

route.get('/historyform/pdf', [mid.checkRolesAndLogout(['Super Admin'])], questionformInput.pdfHistoryFormUser);

module.exports = route;