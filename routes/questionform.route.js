const questionformController = require('../controllers/questionform.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//get question form
route.get('/user/question/form/:packagetryout_id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getFormByPackage);
route.get('/user/bank/question/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getBankSoal); 
route.get('/user/bank/question/get/:typequestion_id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getBankSoalByType);
route.get('/user/question/get/:banksoal_id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getFormByBankSoal); 

route.post('/user/question/form/createmulti', [mid.checkRolesAndLogout(['Super Admin'])], upload.any(), questionformController.createMultiQuestionForm);
route.put('/user/question/form/updatemulti/:banksoalId', upload.any(), questionformController.updateMultiQuestionForm); 
route.put('/user/question/form/update/:id', [mid.checkRolesAndLogout([ 'Super Admin'])], questionformController.updateQuestionForm); 

route.delete('/user/question/form/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], questionformController.deleteQuestionForm);

//get semua from pertanyaan
route.get('/user/question/formulir/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getQuestionForm); 
//get form by id
route.get('/user/question/formulir/get/:id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], questionformController.getQuestionFormById); 

route.post('/user/import/bank/question', [mid.checkRolesAndLogout(['Super Admin'])], upload.single('file'), questionformController.importBankSoal);
route.post('/user/export/bank/question', [mid.checkRolesAndLogout(['Super Admin'])], questionformController.exportBankSoal);


module.exports = route;