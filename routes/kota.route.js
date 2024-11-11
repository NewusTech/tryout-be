const kotaController = require('../controllers/kota.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.get('/user/kota/get', kotaController.getKota); 
route.get('/user/kota/get/:id', kotaController.getKotaById); 

module.exports = route;