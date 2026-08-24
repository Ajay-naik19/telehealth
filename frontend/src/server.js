require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
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

// --- Redis Adapter for Horizontal Scaling ---
(async () => {
    try {
        if (process.env.REDIS_URL) {
            const adapterOpts = {
                url: process.env.REDIS_URL,
                socket: {
                    connectTimeout: 5000,
                    reconnectStrategy: (retries) => {
                        if (retries > 5) return false;
                        return Math.min(retries * 200, 3000);
                    }
                }
            };
            const pubClient = createClient(adapterOpts);
            const subClient = pubClient.duplicate();
            pubClient.on('error', (err) => logger.warn('Redis adapter pub error:', err.message));
            subClient.on('error', (err) => logger.warn('Redis adapter sub error:', err.message));
            await Promise.all([pubClient.connect(), subClient.connect()]);
            io.adapter(createAdapter(pubClient, subClient));
            logger.info('Socket.IO Redis adapter connected for horizontal scaling');
        }
    } catch (err) {
        logger.warn('Socket.IO Redis adapter failed, running single-instance mode:', err.message);
    }
})();

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

    // 5. Close Redis
    try {
        const redisClient = await config.getClient();
        if (redisClient) {
            await redisClient.quit();
            logger.info('Redis connection closed');
        }
    } catch (err) {
        logger.error('Error closing Redis:', err.message);
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
