const userinfoController = require('../controllers/userinfo.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.get('/user/info/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], userinfoController.getDataUser); 
route.get('/user/info/get/:slug', [mid.checkRolesAndLogout(['Super Admin', 'User'])], userinfoController.getUserBySlug); 
route.delete('/user/info/delete/:slug', [mid.checkRolesAndLogout(['Super Admin'])], userinfoController.deleteUser);
route.post('/user/info/create', [mid.checkRolesAndLogout(['Super Admin'])], upload.single('image_profile'), userinfoController.createUserInfo); 
route.put('/user/info/update/:slug', [mid.checkRolesAndLogout(['Super Admin', 'User'])], upload.single('image_profile'), userinfoController.updateUserInfo);


module.exports = route;