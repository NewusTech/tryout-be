const baseConfig = require('../config/base.config');
const { response } = require('../helpers/response.formatter');
const { Token } = require('../models');
const jwt = require('jsonwebtoken');

const checkRolesAndLogout = (allowedRoles) => async (req, res, next) => {
    let token;
    try {
        token = req.headers.authorization.split(' ')[1];
    } catch (err) {
        res.status(403).json(response(403, 'Unauthorized: invalid or missing token'));
        return;
    }

    if (!token) {
        res.status(403).json(response(403, 'Unauthorized: token not found'));
        return;
    }

    jwt.verify(token, baseConfig.auth_secret, async (err, decoded) => {
        if (err) {
            res.status(403).json(response(403, 'Unauthorized: token expired or invalid'));
            return;
        }

        req.user = decoded;

        const tokenCheck = await Token.findOne({ where: { token } });

        if (tokenCheck) {
            res.status(403).json(response(403, 'Unauthorized: already logged out'));
            return;
        }

        if (allowedRoles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json(response(403, 'Forbidden: insufficient access rights'));
        }
    });
};

const checkRoles = () => async (req, res, next) => {
    let token;
    try {
        token = req.headers.authorization.split(' ')[1];
    } catch (err) {
    }

    jwt.verify(token, baseConfig.auth_secret, async (err, decoded) => {
        data = decoded;
        next();
    });
};

module.exports = {
    checkRolesAndLogout, checkRoles
};
