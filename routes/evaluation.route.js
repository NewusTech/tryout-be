const evaluationController = require('../controllers/evaluation.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();


// untuk admin get evaluation
route.get('/user/evaluation/get/:userinfo_id', evaluationController.getEvaluation); 
route.post('/user/evaluation/create/:userinfo_id', [mid.checkRolesAndLogout([ 'Super Admin'])], evaluationController.createEvaluation); 
route.get('/user/detail/evaluation/user/:id', [mid.checkRolesAndLogout([ 'Super Admin', 'User'])], evaluationController.getEvaluationById);
route.put('/user/evaluation/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], evaluationController.updateEvaluation);
route.get('/user/get/evaluation/mentor', [mid.checkRolesAndLogout(['Super Admin', 'User'])], evaluationController.getUserEvaluation); 

module.exports = route;