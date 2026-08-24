const socketConfig = {
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true
    }
};

// Grace period for reconnection (30 seconds)
const GRACE_TIMEOUT_MS = 30000;

// Time window: allow joining X minutes before and Y minutes after appointment time
const TIME_WINDOW = {
    BEFORE_MINUTES: 10,
    AFTER_MINUTES: 30
};

module.exports = { socketConfig, GRACE_TIMEOUT_MS, TIME_WINDOW };
