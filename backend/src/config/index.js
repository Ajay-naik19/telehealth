require('dotenv').config();

const { pool, testConnection, cleanupExpiredTokens, stopPoolMonitor, getPoolHealth } = require('./database');
const { upload, createCleanupMiddleware } = require('./upload');
const { socketConfig } = require('./socket');

const PORT = process.env.PORT || 10000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const HOST = NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const FRONTEND_URL = process.env.FRONTEND_URL;
const FRONTEND_URLS = (process.env.FRONTEND_URLS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const CORS_ALLOWED_ORIGINS = NODE_ENV === 'production'
    ? Array.from(new Set([FRONTEND_URL, ...FRONTEND_URLS].filter(Boolean)))
    : ['http://localhost:3000', 'http://localhost:8080'];

if (NODE_ENV === 'production' && CORS_ALLOWED_ORIGINS.length === 0) {
    throw new Error('In production, set FRONTEND_URL (or FRONTEND_URLS) to explicit allowed origins');
}

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error('ACCESS_TOKEN_SECRET (or JWT_SECRET) and REFRESH_TOKEN_SECRET must both be set');
}
if (ACCESS_TOKEN_SECRET === REFRESH_TOKEN_SECRET) {
    console.warn('WARNING: ACCESS and REFRESH token secrets should be different for security');
}
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRE_MINUTES
    ? `${process.env.ACCESS_TOKEN_EXPIRE_MINUTES}m` : '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRE_DAYS
    ? `${process.env.REFRESH_TOKEN_EXPIRE_DAYS}d` : '7d';

function isLocalHost(host = '') {
    return /(^|:)(localhost|127\.0\.0\.1)(:|$)/i.test(host);
}

function shouldUseSecureCookies(req) {
    const host = req?.get?.('host') || '';
    const forwardedProto = req?.get?.('x-forwarded-proto');
    const isHttps = req?.secure || forwardedProto === 'https';

    if (isLocalHost(host)) return false;
    if (NODE_ENV !== 'production') return false;

    return Boolean(isHttps || (FRONTEND_URL && FRONTEND_URL.startsWith('https://')));
}

function buildCookieOptions(req, maxAge) {
    const secure = shouldUseSecureCookies(req);

    return {
        httpOnly: true,
        secure,
        sameSite: secure ? 'None' : 'Lax',
        path: '/',
        ...(typeof maxAge === 'number' ? { maxAge } : {}),
    };
}

const accessTokenCookieOptions = buildCookieOptions(null, 15 * 60 * 1000);

const refreshTokenCookieOptions = buildCookieOptions(null, 7 * 24 * 60 * 60 * 1000);

const clearCookieOptions = buildCookieOptions(null);

function getAccessTokenCookieOptions(req) {
    return buildCookieOptions(req, 15 * 60 * 1000);
}

function getRefreshTokenCookieOptions(req) {
    return buildCookieOptions(req, 7 * 24 * 60 * 60 * 1000);
}

function getClearCookieOptions(req) {
    return buildCookieOptions(req);
}

const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser requests with no Origin header (health checks, server-to-server, curl).
        if (!origin) return callback(null, true);

        if (CORS_ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600
};

module.exports = {
    // Server
    PORT, NODE_ENV, HOST, FRONTEND_URL, FRONTEND_URLS, CORS_ALLOWED_ORIGINS, corsOptions,
    // Auth / JWT
    ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY,
    accessTokenCookieOptions, refreshTokenCookieOptions, clearCookieOptions,
    getAccessTokenCookieOptions, getRefreshTokenCookieOptions, getClearCookieOptions,
    // Database
    pool, testConnection, cleanupExpiredTokens, stopPoolMonitor, getPoolHealth,
    // Upload
    upload, createCleanupMiddleware,
    // Socket
    socketConfig
};
