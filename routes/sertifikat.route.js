const sertifikatController = require('../controllers/sertifikat.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// untuk admin setting sertifikat
route.get('/user/detail/setting/sertifikat', [mid.checkRolesAndLogout([ 'Super Admin', 'User'])], sertifikatController.getSettingSertifikat);
route.put('/user/edit/setting/sertifikat',  upload.fields([{ name: 'sign' }]), [mid.checkRolesAndLogout(['Super Admin'])], sertifikatController.updateSettingSertifikat); 

// get sertifikat user
route.get('/user/pdf/:idquestionformnum/sertifikat', [mid.checkRolesAndLogout([ 'Super Admin', 'User'])], sertifikatController.getUserSertifikat);

route.get('/user/sertifikat/:idpackage/:idforminput', sertifikatController.getOutputSertifikat); 


module.exports = route;