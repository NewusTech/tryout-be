const socialmediaController = require('../controllers/socialmedia.controller');

const mid = require('../middlewares/auth.middleware');

const express = require('express');
const route = express.Router();

route.post('/user/social/media/create', [mid.checkRolesAndLogout(['Super Admin'])], socialmediaController.createSocialMedia);
route.get('/user/social/media/get', socialmediaController.getSocialMedia); 
route.get('/user/social/media/get/:id', socialmediaController.getSocialMediaById); 
route.put('/user/social/media/update/:id', [mid.checkRolesAndLogout(['Super Admin'])], socialmediaController.updateSocialMedia); 
route.delete('/user/social/media/delete/:id', [mid.checkRolesAndLogout(['Super Admin'])], socialmediaController.deleteSocialMedia);

module.exports = route;