const typepackageController = require('../controllers/typepackage.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.get('/user/type/package/get', typepackageController.getTypePackage); 
route.get('/user/type/package/get/:id', typepackageController.getTypePackageById);
route.post('/user/type/package/create', [mid.checkRolesAndLogout(['Super Admin'])], typepackageController.createTypePackage); 
route.put('/user/type/package/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], typepackageController.updateTypePackage); 
route.delete('/user/type/package/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], typepackageController.deleteTypePackage);

module.exports = route;