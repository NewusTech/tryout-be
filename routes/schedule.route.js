const scheduleController = require('../controllers/schedule.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/user/tryout/schedule/create', [mid.checkRolesAndLogout(['Super Admin'])], scheduleController.createSchedule);
route.get('/user/tryout/schedule/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], scheduleController.getScheduleTryout);
route.get('/user/tryout/schedule/get/:id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], scheduleController.getSchedulById);


route.get('/user/event/tryout/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], scheduleController.getUserScheduleTryout);
module.exports = route;