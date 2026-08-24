// backend/.env.local or backend/.env override the legacy src/.env
// configuration. This keeps local PostgreSQL credentials out of source while
// preserving existing setups.
const path = require('path');
require('dotenv').config({
    path: [
        path.join(__dirname, '..', '.env.local'),
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '.env')
    ]
});

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const initializeSocket = require('./modules/video/video.socket');

const server = http.createServer(app);

// --- Socket.IO Setup ---
const io = new Server(server, {
    cors: {
        origin: config.corsOptions.origin,
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
    },
    ...config.socketConfig
});

// Local development intentionally uses Socket.IO's in-memory adapter.
// Redis is not required unless horizontal scaling is added back.

// --- Socket.IO Auth Middleware (reusable for namespaces) ---
function socketAuthMiddleware(socket, next) {
    try {
        let token = socket.handshake.auth.token;
        const origin = socket.handshake.headers.origin || 'unknown-origin';
        const hasAuthToken = Boolean(socket.handshake.auth?.token);
        const hasCookieHeader = Boolean(socket.handshake.headers.cookie);

        if (!token) {
            const cookieHeader = socket.handshake.headers.cookie;
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=');
                    acc[key] = value;
                    return acc;
                }, {});
                token = cookies.accessToken;
            }
        }

        if (!token) {
            logger.warn('Socket auth rejected: missing token', {
                socketId: socket.id,
                origin,
                hasAuthToken,
                hasCookieHeader,
                transport: socket.conn?.transport?.name,
                address: socket.handshake.address
            });
            return next(new Error('Authentication required'));
        }

        const payload = jwt.verify(token, config.ACCESS_TOKEN_SECRET);
        socket.user = {
            id: payload.id,
            role: payload.role
        };
        logger.info('Socket auth accepted', {
            socketId: socket.id,
            origin,
            userId: payload.id,
            role: payload.role,
            transport: socket.conn?.transport?.name
        });
        next();
    } catch (error) {
        logger.warn('Socket auth rejected: invalid token', {
            socketId: socket.id,
            origin: socket.handshake.headers.origin || 'unknown-origin',
            hasAuthToken: Boolean(socket.handshake.auth?.token),
            hasCookieHeader: Boolean(socket.handshake.headers.cookie),
            errorName: error?.name,
            errorMessage: error?.message,
            transport: socket.conn?.transport?.name,
            address: socket.handshake.address
        });
        return next(new Error('Invalid or expired token'));
    }
}

// Apply auth to default namespace
io.use(socketAuthMiddleware);

// Expose io on app for controller access and auth middleware for namespaces
app.set('io', io);
app.set('socketAuthMiddleware', socketAuthMiddleware);

initializeSocket(io);

// --- Startup ---
async function startServer() {
    try {
        await config.testConnection();
        setInterval(config.cleanupExpiredTokens, 60 * 60 * 1000);

        server.listen(config.PORT, config.HOST, () => {
            logger.info(`Server running on http://${config.HOST}:${config.PORT}`);
            logger.info(`Socket.IO ready on ws://${config.HOST}:${config.PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// --- Graceful Shutdown ---
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Force shutdown after 10 seconds
    const forceExitTimer = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    // 1. Stop pool monitor
    config.stopPoolMonitor();

    // 2. Close Socket.IO
    io.close();
    logger.info('Socket.IO closed');

    // 3. Stop accepting new HTTP requests
    server.close(() => {
        logger.info('HTTP server closed');
    });

    // 4. Close database pool
    try {
        await config.pool.end();
        logger.info('Database pool closed');
    } catch (err) {
        logger.error('Error closing database pool:', err.message);
    }

    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Don't shutdown on non-fatal exceptions - let the process recover
    // Only exit on truly fatal errors (out of memory, etc.)
});

startServer();

module.exports = { server, io };
