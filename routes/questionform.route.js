const questionformController = require('../controllers/questionform.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

//get from by question
route.get('/user/question/form/:packagetryout_id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getFormByPackage);
route.get('/user/bank/question/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getBankSoal); 
route.get('/user/bank/question/get/:typequestion_id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getBankSoalByType); 

route.post('/user/question/form/createmulti', [mid.checkRolesAndLogout(['Super Admin'])], questionformController.createMultiQuestionForm);
route.put('/user/question/form/update/:id', [mid.checkRolesAndLogout([ 'Super Admin'])], questionformController.updateQuestionForm); 
route.put('/user/question/form/updatemulti', [mid.checkRolesAndLogout(['Super Admin'])], questionformController.updateMultiQuestionForm); 
route.delete('/user/question/form/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], questionformController.deleteQuestionForm);

//get semua from pertanyaan
route.get('/user/question/formulir/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getQuestionForm); 
//get form by id
route.get('/user/question/formulir/get/:id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getQuestionFormById); 

module.exports = route;