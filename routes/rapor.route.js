const raporController = require('../controllers/rapor.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// untuk admin generate rapor
route.get('/user/rapor/get/:userinfo_id', raporController.getRapor); 
route.get('/user/rapor/output/get/:userinfo_id', raporController.getOutputRapor); 

route.post('/user/get/rapor/user', [mid.checkRolesAndLogout([ 'Super Admin', 'User'])], raporController.generateOutputRapor); 


module.exports = route;