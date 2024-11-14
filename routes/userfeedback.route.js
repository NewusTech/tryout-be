const userfeedbackController = require('../controllers/userfeedback.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/user/feedback/create/:idpackage', [mid.checkRolesAndLogout(['User'])], userfeedbackController.createFeedback);
route.get('/user/history/feedback/detail/:idfeedback', [mid.checkRolesAndLogout(['User', 'Super Admin'])], userfeedbackController.getDetailHistoryFeedback);
route.get('/user/history/feedback/get', [mid.checkRolesAndLogout(['Super Admin'])], userfeedbackController.getAllUserFeedbackHistory);
route.get('/user/history/feedback/:idpackage', [mid.checkRolesAndLogout(['Super Admin'])], userfeedbackController.getHistoryByPackage);

module.exports = route;