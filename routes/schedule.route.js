const scheduleController = require('../controllers/schedule.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/user/tryout/schedule/create', [mid.checkRolesAndLogout(['Super Admin'])], scheduleController.createSchedule);
route.post('/user/get/tryout/schedule', [mid.checkRolesAndLogout(['Super Admin', 'User'])], scheduleController.getScheduleTryout);


module.exports = route;