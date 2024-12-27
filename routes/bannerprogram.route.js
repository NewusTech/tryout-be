const BannerProgramController = require('../controllers/bannerprogram.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

route.post('/user/banner/program/create', [mid.checkRolesAndLogout(['Super Admin'])], upload.fields([{ name: 'image', maxCount: 1 }]), BannerProgramController.createBannerProgram);
route.get('/user/banner/program/get', BannerProgramController.getBannerProgram); 
route.get('/user/banner/program/get/:id', BannerProgramController.getBannerProgramById); 
route.put('/user/banner/program/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], upload.fields([{ name: 'image', maxCount: 1 }]), BannerProgramController.updateBannerProgram); 
route.delete('/user/banner/program/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], BannerProgramController.deleteBannerProgram);

module.exports = route;