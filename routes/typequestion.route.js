const typequestionController = require('../controllers/typequestion.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.get('/user/type/question/get', typequestionController.getTypeQuestion); 
route.get('/user/type/question/get/:id', typequestionController.getTypeQuestionById);
route.post('/user/type/question/create', [mid.checkRolesAndLogout(['Super Admin'])], typequestionController.createTypeQuestion); 
route.put('/user/type/question/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], typequestionController.updateTypeQuestion); 
route.delete('/user/type/question/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], typequestionController.deleteTypeQuestion);

module.exports = route;