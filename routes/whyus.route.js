const whyusController = require('../controllers/whyus.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/user/why/us/create', [mid.checkRolesAndLogout(['Super Admin'])], whyusController.createWhyUs);
route.get('/user/why/us/get', whyusController.getWhyUs); 
route.get('/user/why/us/get/:id', whyusController.getWhyUsById); 
route.put('/user/why/us/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], whyusController.updateWhyUs); 
route.delete('/user/why/us/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], whyusController.deleteWhyUs);

module.exports = route;