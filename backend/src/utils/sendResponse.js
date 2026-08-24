function sendResponse(res, status, message, data = null) {
    return res.status(status).json({
        success: status >= 200 && status < 400,
        message,
        data
    });
}

module.exports = sendResponse;
