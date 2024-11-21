const paymentController = require('../controllers/payment.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.get('/user/report/payment/get', [mid.checkRolesAndLogout(['User', 'Super Admin'])], paymentController.getReportPayment); 
route.get('/user/report/payment/:slug', [mid.checkRolesAndLogout(['Super Admin', 'User'])], paymentController.getReportPaymentBySlug); 
route.get('/user/receipt/:idpayment', paymentController.getReceiptPayment); 

module.exports = route;