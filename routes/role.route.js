const roleController = require('../controllers/role.controller');

//import middleware dari auth.middleware.js
const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/user/role/create', [mid.checkRolesAndLogout(['Super Admin'])], roleController.createRole);
route.get('/user/role/get', [mid.checkRolesAndLogout(['Super Admin'])], roleController.getRole); 
route.get('/user/role/get/:id', [mid.checkRolesAndLogout(['Super Admin'])], roleController.getRoleById); 
route.put('/user/role/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], roleController.updateRole); 
route.delete('/user/role/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], roleController.deleteRole);

module.exports = route;