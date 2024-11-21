const userController = require('../controllers/user.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.post('/register', userController.registrasiUser);
route.post('/login', userController.loginUser);
route.post('/logout', [mid.checkRolesAndLogout(['Super Admin', 'User'])], userController.logoutUser); 
route.post('/registerbyadmin', upload.fields([{ name: 'receipt', maxCount: 1 }]),  userController.createUserByAdmin);

// API UNTUK ADMIN / SUPER ADMIN
route.get('/user/get', [mid.checkRolesAndLogout(['Super Admin'])], userController.getUser); 
route.get('/user/get/:slug', [mid.checkRolesAndLogout(['Super Admin'])], userController.getUserBySlug); 
route.delete('/user/delete/:slug', [mid.checkRolesAndLogout(['Super Admin'])], userController.deleteUser);

//API BUAT USER
route.get('/user/profile/get', [mid.checkRolesAndLogout(['User', 'Super Admin'])], userController.getProfileUser); 

route.post('/changepwadmin/:slug', [mid.checkRolesAndLogout(['Admin Verifikasi', 'Admin Layanan', 'Super Admin', 'User'])], userController.changePasswordFromAdmin); 
route.post('/user/change/password/:slug', [mid.checkRolesAndLogout(['Super Admin', 'User'])], userController.changePassword); 
route.post('/user/forgot/password', userController.forgotPassword); 
route.post('/user/reset/:token', userController.resetPassword); 
route.put('/user/permissions', [mid.checkRolesAndLogout(['Super Admin'])],userController.updateUserPermissions);
route.get('/user/permissions/:userId', userController.getUserPermissions);

module.exports = route;