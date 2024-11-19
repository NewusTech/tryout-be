const typepaymentController = require('../controllers/typepayment.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.get('/user/type/payment/get', typepaymentController.getTypePayment); 
route.get('/user/type/payment/get/:id', typepaymentController.getTypePaymentById);
route.post('/user/type/payment/create', [mid.checkRolesAndLogout(['Super Admin'])], typepaymentController.createTypePayment); 
route.put('/user/type/payment/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], typepaymentController.updateTypePayment); 
route.delete('/user/type/payment/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], typepaymentController.deleteTypePayment);

module.exports = route;