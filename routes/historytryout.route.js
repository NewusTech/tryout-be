const questionformInput = require('../controllers/questionforminput.controller.js');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.get('/user/history/tryout', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformInput.getHistoryFormUser);
route.get('/user/history/tryout/:idquestion_num', questionformInput.getHistoryById);
route.get('/user/discussion/tryout/:idquestion_num', [mid.checkRolesAndLogout([ 'Super Admin', 'User'])], questionformInput.getDiscussionById);
route.get('/user/report/result/:idquestion_num', [mid.checkRolesAndLogout([ 'Super Admin', 'User'])], questionformInput.getHistoryResultTryoutById);

route.get('/historyform/pdf', [mid.checkRolesAndLogout(['Super Admin'])], questionformInput.pdfHistoryFormUser);

route.get('/user/tryout/history/:packagetryout_id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformInput.getDetailPackageTryout);
module.exports = route;