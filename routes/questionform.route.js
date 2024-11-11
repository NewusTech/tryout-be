const questionformController = require('../controllers/questionform.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

//get from by question
route.get('/user/question/form/:packagetryout_id', [mid.checkRolesAndLogout(['Super Admin', 'User', 'Kepala Bidang'])], questionformController.getFormByPackage); 

route.post('/user/question/form/create', [mid.checkRolesAndLogout(['Super Admin', 'Kepala Bidang'])], questionformController.createQuestionForm);
route.post('/user/question/form/createmulti', [mid.checkRolesAndLogout(['Super Admin', 'Kepala Bidang'])], questionformController.createMultiQuestionForm);
route.put('/user/question/form/update/:id', [mid.checkRolesAndLogout([ 'Super Admin', 'Kepala Bidang'])], questionformController.updateQuestionForm); 
route.put('/user/question/form/updatemulti', [mid.checkRolesAndLogout(['Super Admin', 'Kepala Bidang'])], questionformController.updateMultiQuestionForm); 
route.delete('/user/question/form/delete/:id', [mid.checkRolesAndLogout(['Super Admin', 'Kepala Bidang'])], questionformController.deleteQuestionForm);

//get semua from --> gak bakal kepake
route.get('/user/question/formulir/get', [mid.checkRolesAndLogout(['Super Admin'])], questionformController.getQuestionForm); 
//get form by id --> gak bakal kepake
route.get('/user/question/formulir/get/:id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getQuestionFormById); 

module.exports = route;