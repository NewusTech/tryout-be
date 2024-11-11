const userController = require('../controllers/user.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/register', userController.createUser);
route.post('/login', userController.loginUser);
route.post('/logout', [mid.checkRolesAndLogout(['Super Admin', 'User'])], userController.logoutUser); 

// API UNTUK ADMIN / SUPER ADMIN
route.get('/user/get', [mid.checkRolesAndLogout(['Super Admin'])], userController.getUser); 
route.get('/user/get/:slug', [mid.checkRolesAndLogout(['Super Admin'])], userController.getUserBySlug); 
route.delete('/user/delete/:slug', [mid.checkRolesAndLogout(['Super Admin'])], userController.deleteUser);

//API BUAT USER
route.get('/user/profile/get', [mid.checkRolesAndLogout(['User', 'Super Admin'])], userController.getProfileUser); 

route.post('/changepassword/:slug', [mid.checkRolesAndLogout(['Admin Verifikasi', 'Admin Layanan', 'Super Admin', 'User'])], userController.changePassword); 

route.post('/changepwadmin/:slug', [mid.checkRolesAndLogout(['Admin Verifikasi', 'Admin Layanan', 'Super Admin', 'User'])], userController.changePasswordFromAdmin); 

route.post('/forgotpassword', userController.forgotPassword); 

route.post('/reset/:token', userController.resetPassword); 

route.put('/permissions', [mid.checkRolesAndLogout(['Super Admin'])],userController.updateUserpermissions);

route.get('/permissions/:userId', userController.getUserPermissions);

module.exports = route;