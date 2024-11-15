const userController = require('../controllers/user.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.get('/user/report/payment/get', [mid.checkRolesAndLogout(['User', 'Super Admin'])], userController.getReportPayment); 
route.get('/user/report/payment/:slug', [mid.checkRolesAndLogout(['Super Admin', 'User'])], userController.getReportPaymentBySlug); 

module.exports = route;