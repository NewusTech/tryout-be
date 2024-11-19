const termconditionController = require('../controllers/termcondition.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
 
route.get('/user/tnc/get', termconditionController.getTermCondition); 
route.put('/user/tnc/update', [mid.checkRolesAndLogout(['Super Admin'])], termconditionController.updateTermCondition); 

module.exports = route;