const userRoute = require('./user.route');
const userinfoRoute = require('./userinfo.route');
const roleRoute = require('./role.route');
const permissionRoute = require('./permission.route');
const provinsiRoute = require('./provinsi.route');
const kotaRoute = require('./kota.route');
const typepackageRoute = require('./typepackage.route');
const typequestionRoute = require('./typequestion.route');
const packagetryoutRoute = require('./packagetryout.route');
const questionformRoute = require('./questionform.route');
const inputformRoute = require('./inputform.route');
const historytryoutRoute = require('./historytryout.route');
const userfeedbackRoute = require('./userfeedback.route');
const aboutcompanyRoute = require('./aboutcompany.route');
const bannerRoute = require('./banner.route');
const scheduleRoute = require('./schedule.route');
const typeuserRoute = require('./typeuser.route');
const reportpaymentRoute = require('./reportpayment.route');

module.exports = function (app, urlApi) {
    app.use(urlApi, userRoute);
    app.use(urlApi, userinfoRoute);
    app.use(urlApi, roleRoute);
    app.use(urlApi, permissionRoute);
    app.use(urlApi, provinsiRoute);
    app.use(urlApi, kotaRoute);
    app.use(urlApi, typepackageRoute);
    app.use(urlApi, typequestionRoute);
    app.use(urlApi, packagetryoutRoute);
    app.use(urlApi, questionformRoute);
    app.use(urlApi, inputformRoute);
    app.use(urlApi, historytryoutRoute);
    app.use(urlApi, userfeedbackRoute);
    app.use(urlApi, aboutcompanyRoute);
    app.use(urlApi, bannerRoute);
    app.use(urlApi, scheduleRoute);
    app.use(urlApi, typeuserRoute);
    app.use(urlApi, reportpaymentRoute);
}