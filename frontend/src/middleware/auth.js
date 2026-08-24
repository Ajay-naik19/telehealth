const config = require('../config');
const authService = require('../modules/auth/auth.service');
const sendResponse = require('../utils/sendResponse');

function clearAuthCookies(res) {
    const req = res.req;
    res.clearCookie("accessToken", config.getClearCookieOptions(req));
    res.clearCookie("refreshToken", config.getClearCookieOptions(req));
}

function sendAuthError(req, res, status, message) {
    return sendResponse(res, status, message, null);
}

async function authenticate(req, res, next) {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken && !refreshToken) {
        return sendAuthError(req, res, 401, 'Authentication required');
    }

    try {
        const payload = await authService.verifyAccessToken(accessToken);
        req.user = { id: payload.id, role: payload.role };
        next();
    } catch (accessTokenError) {
        if (!refreshToken) {
            clearAuthCookies(res);
            return sendAuthError(req, res, 401, 'Session expired. Please log in again.');
        }
        await handleRefreshToken(req, res, next, refreshToken);
    }
}

async function handleRefreshToken(req, res, next, refreshToken) {
    try {
        const user = await authService.verifyRefreshToken(refreshToken);
        await authService.revokeRefreshToken(refreshToken);
        const tokens = await authService.generateTokens(user);

        res.cookie("accessToken", tokens.accessToken, config.getAccessTokenCookieOptions(req));
        res.cookie("refreshToken", tokens.refreshToken, config.getRefreshTokenCookieOptions(req));
        req.user = { id: user.id, role: user.role };
        next();
    } catch (error) {
        clearAuthCookies(res);
        return sendAuthError(req, res, 401, 'Session expired. Please log in again.');
    }
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return sendAuthError(req, res, 403, 'Access denied');
        }
        next();
    };
}

module.exports = {
    clearAuthCookies,
    authenticate,
    handleRefreshToken,
    authorize
};