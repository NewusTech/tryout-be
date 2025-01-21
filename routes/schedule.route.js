const scheduleController = require('../controllers/schedule.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/user/tryout/schedule/create', [mid.checkRolesAndLogout(['Super Admin'])], scheduleController.createSchedule);
route.put('/user/tryout/schedule/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], scheduleController.updateSchedule);
route.get('/user/tryout/schedule/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], scheduleController.getScheduleTryout);
route.get('/user/tryout/schedule/get/:id', [mid.checkRolesAndLogout(['Super Admin', 'User'])], scheduleController.getSchedulById);

route.get('/user/event/tryout/get', [mid.checkRolesAndLogout(['Super Admin', 'User'])], scheduleController.getUserScheduleTryout);
route.get('/user/live/mentoring/tryout/get', scheduleController.getLiveMonitoringScoring);
route.get('/user/history/mentoring/tryout/get', scheduleController.getHistoryMonitoring);

route.get('/user/data/event/:packagetryout_id', scheduleController.getDataForPDF);
route.get('/user/result/event/pdf/:packagetryout_id', scheduleController.getPDFHistory);

module.exports = route;