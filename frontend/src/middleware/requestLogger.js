const expressWinston = require('express-winston');
const logger = require('../utils/logger');

const requestLogger = expressWinston.logger({
    winstonInstance: logger,
    level: 'info',
    msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
    meta: true,
    expressFormat: false,
    colorize: false,
    requestFilter: (req, propName) => {
        const sensitive = ['password', 'confirmpassword', 'token', 'accessToken', 'refreshToken'];
        if (sensitive.includes(propName)) {
            return '[REDACTED]';
        }
        return req[propName];
    },
    dynamicMeta: (req, res) => ({
        requestId: req.id,
        ip: req.ip,
        userId: req.user?.id || null,
        role: req.user?.role || null
    }),
    ignoreRoute: (req) => req.path === '/health' || req.path === '/api-docs'
});

const errorLogger = expressWinston.errorLogger({
    winstonInstance: logger,
    level: 'error',
    msg: 'HTTP {{req.method}} {{req.url}} {{err.message}}',
    meta: true,
    dynamicMeta: (req) => ({
        requestId: req.id,
        userId: req.user?.id || null,
        role: req.user?.role || null
    })
});

module.exports = {
    requestLogger,
    errorLogger
};
