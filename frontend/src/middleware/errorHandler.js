const multer = require('multer');
const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');
const sendResponse = require('../utils/sendResponse');

function errorHandler(err, req, res, next) {
    err.statusCode = err.statusCode || 500;
    err.isOperational = err.isOperational || false;

    if (err.statusCode >= 500) {
        logger.error(err.message, { stack: err.stack, url: req.originalUrl, method: req.method });
    } else {
        logger.warn(err.message, { statusCode: err.statusCode, url: req.originalUrl, method: req.method });
    }

    if (err instanceof multer.MulterError) {
        err.statusCode = 400;
        err.message = `File upload error: ${err.message}`;
        err.isOperational = true;
    }

    if (err.name === 'JsonWebTokenError') {
        err.statusCode = 401;
        err.message = 'Invalid token';
        err.isOperational = true;
    }

    if (err.name === 'TokenExpiredError') {
        err.statusCode = 401;
        err.message = 'Token expired';
        err.isOperational = true;
    }

    const message = err.isOperational ? err.message : 'Internal Server Error';

    const data = {
        requestId: req.id,
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    };

    return sendResponse(res, err.statusCode, message, data);
}

function notFoundHandler(req, res) {
    logger.warn(`404: ${req.method} ${req.originalUrl}`);
    return sendResponse(res, 404, 'Route not found', null);
}

module.exports = { errorHandler, notFoundHandler };
