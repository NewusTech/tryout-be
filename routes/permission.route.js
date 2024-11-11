const permissionController = require('../controllers/permission.controller');

//import middleware dari auth.middleware.js
const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('user/permission/create', [mid.checkRolesAndLogout(['Super Admin'])], permissionController.createPermission);
route.get('user/permission/get', [mid.checkRolesAndLogout(['Super Admin'])], permissionController.getPermission); 
route.get('user/permission/get/:id', [mid.checkRolesAndLogout(['Super Admin'])], permissionController.getPermissionById); 
route.put('user/permission/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], permissionController.updatePermission); 
route.delete('user/permission/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], permissionController.deletePermission);

module.exports = route;