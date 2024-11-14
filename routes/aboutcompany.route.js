const aboutcompanyController = require('../controllers/aboutcompany.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.post('/user/company/profile/create', [mid.checkRolesAndLogout(['Super Admin'])], upload.fields([{ name: 'main_logo', maxCount: 1 },{ name: 'sub_logo', maxCount: 1 },]), aboutcompanyController.createProfile);
route.get('/user/company/profile/get', aboutcompanyController.getProfile); 
route.get('/user/company/profile/get/:id', aboutcompanyController.getProfileById); 
route.put('/user/company/profile/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], upload.fields([{ name: 'main_logo', maxCount: 1 },{ name: 'sub_logo', maxCount: 1 },]), aboutcompanyController.updateProfile); 
route.delete('/user/company/profile/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], aboutcompanyController.deleteProfile);

module.exports = route;