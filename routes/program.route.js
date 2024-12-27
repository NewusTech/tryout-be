const programController = require('../controllers/program.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();


// untuk admin get program
route.get('/user/program/get', programController.getProgram); 
route.post('/user/program/create', [mid.checkRolesAndLogout([ 'Super Admin'])], programController.createProgram); 
route.get('/user/detail/program/:id', [mid.checkRolesAndLogout([ 'Super Admin'])], programController.getProgramById);
route.put('/user/program/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], programController.updateProgram);
route.delete('/user/program/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], programController.deleteProgram);


module.exports = route;