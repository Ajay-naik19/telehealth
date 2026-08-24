const authService = require('./auth.service');
const config = require('../../config');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');

function setTokenCookies(res, tokens) {
    const req = res.req;
    res.cookie('accessToken', tokens.accessToken, config.getAccessTokenCookieOptions(req));
    res.cookie('refreshToken', tokens.refreshToken, config.getRefreshTokenCookieOptions(req));
}

function clearAuthCookies(res) {
    const req = res.req;
    res.clearCookie('accessToken', config.getClearCookieOptions(req));
    res.clearCookie('refreshToken', config.getClearCookieOptions(req));
}

exports.userSignup = catchAsync(async (req, res) => {
    const { phone, password, confirmpassword } = req.body;
    const { tokens, session } = await authService.signup(phone, password, confirmpassword, 'user');

    setTokenCookies(res, tokens);
    res.setHeader('Cache-Control', 'no-cache, no-store');

    return sendResponse(res, 201, 'Account created successfully', session);
});

exports.userLogin = catchAsync(async (req, res) => {
    const { phone, password } = req.body;

    const { tokens, session } = await authService.login(phone, password, 'user');
    setTokenCookies(res, tokens);

    return sendResponse(res, 200, 'Login successful', session);
});

exports.docSignup = catchAsync(async (req, res) => {
    const { phone, password, confirmpassword } = req.body;

    const { tokens, session } = await authService.signup(phone, password, confirmpassword, 'doctor');

    setTokenCookies(res, tokens);
    res.setHeader('Cache-Control', 'no-cache, no-store');

    return sendResponse(res, 201, 'Account created successfully', session);
});

exports.docLogin = catchAsync(async (req, res) => {
    const { phone, password } = req.body;

    const { tokens, session } = await authService.login(phone, password, 'doctor');
    setTokenCookies(res, tokens);

    return sendResponse(res, 200, 'Login successful', session);
});

exports.logout = catchAsync(async (req, res) => {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (accessToken) {
        await authService.blacklistAccessToken(accessToken);
    }

    if (refreshToken) {
        try {
            const user = await authService.verifyRefreshToken(refreshToken);
            await authService.revokeAllUserTokens(user.id, user.role);
        } catch (err) {
            // Token already invalid - still clear cookies
        }
    }

    clearAuthCookies(res);
    return sendResponse(res, 200, 'Logged out successfully', null);
});

exports.refreshToken = catchAsync(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return sendResponse(res, 401, 'Refresh token required', null);
    }

    const { tokens, session } = await authService.refreshSession(refreshToken);

    setTokenCookies(res, tokens);

    return sendResponse(res, 200, 'Token refreshed successfully', session);
});

exports.getSession = catchAsync(async (req, res) => {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    res.setHeader('Cache-Control', 'no-store');

    const resolved = await authService.resolveSession(accessToken, refreshToken);

    if (resolved.clearCookies) {
        clearAuthCookies(res);
    }

    if (resolved.tokens) {
        setTokenCookies(res, resolved.tokens);
    }

    if (!resolved.authenticated) {
        return sendResponse(res, 200, 'No active session', { authenticated: false });
    }

    return sendResponse(res, 200, 'Session active', {
        authenticated: true,
        user: resolved.session
    });
});
