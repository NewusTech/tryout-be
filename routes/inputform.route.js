const questionformInput = require('../controllers/questionforminput.controller.js');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.post('/user/input/answer/create/:idpackage', [mid.checkRolesAndLogout(['User', 'Super Admin'])], upload.any(), questionformInput.inputFormQuestion);
route.get('/user/input/answer/detail/:idquestionnum', [mid.checkRolesAndLogout(['User', 'Super Admin'])], questionformInput.getDetailInputForm);
route.put('/user/input/form/file/:idlayanannum', [mid.checkRolesAndLogout(['Super Admin'])], upload.any(), questionformInput.uploadFileHasil);

route.post('/user/start/time/tryout/:packagetryout_id', [mid.checkRolesAndLogout(['User', 'Super Admin'])], questionformInput.startTryoutSession);
route.post('/user/end/time/tryout/:packagetryout_id', [mid.checkRolesAndLogout(['User', 'Super Admin'])], questionformInput.stopTryoutSession);

module.exports = route;