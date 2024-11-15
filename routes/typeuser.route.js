const typeuserController = require('../controllers/typeuser.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.get('/user/type/user/get', typeuserController.getTypeUser); 
route.get('/user/type/user/get/:id', typeuserController.getTypeUserById);
route.post('/user/type/user/create', [mid.checkRolesAndLogout(['Super Admin'])], typeuserController.createTypeUser); 
route.put('/user/type/user/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], typeuserController.updateTypeUser); 
route.delete('/user/type/user/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], typeuserController.deleteTypeUser);

module.exports = route;