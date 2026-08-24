const { Pool } = require('pg');
const path = require('path');

require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: 'TeleHealth',
});

// Handle transient pool errors (self-recovering)
const TRANSIENT_ERRORS = ['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED', '57P01', '57P03'];
pool.on('error', (err) => {
    if (TRANSIENT_ERRORS.includes(err.code)) return;
    console.error('Unexpected database pool error:', err.message);
});

// Pool monitor - keeps event loop aware of the pool
let poolMonitorInterval = null;
function startPoolMonitor() {
    poolMonitorInterval = setInterval(() => {}, 30000);
    poolMonitorInterval.unref();
}
function stopPoolMonitor() {
    if (poolMonitorInterval) {
        clearInterval(poolMonitorInterval);
        poolMonitorInterval = null;
    }
}
startPoolMonitor();

function getPoolHealth() {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
}

async function testConnection(retries = 5, delay = 3000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await pool.query('SELECT 1');
            console.log('✅ Database connection established');
            return;
        } catch (error) {
            console.error(`❌ Database connection attempt ${attempt}/${retries} failed:`, error.message);
            if (attempt < retries) {
                console.log(`Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.error('❌ All database connection attempts failed. Exiting.');
    process.exit(1);
}

async function cleanupExpiredTokens() {
    try {
        const result = await pool.query(
            `DELETE FROM refresh_tokens 
             WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days' 
                OR revoked = TRUE AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '7 days'`
        );
        console.log(`Cleaned up ${result.rowCount} expired tokens`);
    } catch (error) {
        console.error('Token cleanup error:', error);
    }
}

module.exports = {
    pool,
    testConnection,
    cleanupExpiredTokens,
    stopPoolMonitor,
    getPoolHealth
};