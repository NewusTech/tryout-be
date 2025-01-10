const packageinformationController = require('../controllers/packageinformation.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();


// untuk admin get program
route.get('/user/package/information/get', packageinformationController.getPackageInformation); 
route.post('/user/package/information/create', [mid.checkRolesAndLogout([ 'Super Admin'])], packageinformationController.createPackageInformation); 
route.get('/user/detail/package/information/:id', [mid.checkRolesAndLogout([ 'Super Admin'])], packageinformationController.getPackageInformationById);
route.put('/user/package/information/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], packageinformationController.updatePackageInformation);
route.delete('/user/package/information/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], packageinformationController.deletePackageInformation);


module.exports = route;