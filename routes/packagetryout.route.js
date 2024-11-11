const packagetryoutController = require('../controllers/packagetryout.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.post('/user/package/tryout/create', [mid.checkRolesAndLogout(['Super Admin'])], packagetryoutController.createPackage);
route.get('/user/package/tryout/get', packagetryoutController.getPackageTryout);
route.get('/user/type/package/tryout/get/:typepackage_id', packagetryoutController.getPackageByType); 
route.get('/user/package/tryout/get/:id', packagetryoutController.getPackageById);
route.put('/user/package/tryout/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], packagetryoutController.updatePackage); 
route.delete('/user/package/tryout/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], packagetryoutController.deletePackage);


module.exports = route;