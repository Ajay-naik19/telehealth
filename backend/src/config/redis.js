/*
const { createClient } = require('redis');
require('dotenv').config();

let redisClient = null;
let isConnected = false;
let lastConnectAttemptAt = 0;

const RETRY_GAP_MS = 10000;

const getClient = async () => {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.REDIS_URL,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => {
                    if (retries > 10) return false;
                    return Math.min(retries * 200, 3000);
                }
            }
        });

        redisClient.on('error', (err) => {
            if (isConnected) {
                console.log('Redis connection error (non-critical):', err.message);
            }
            isConnected = false;
        });

        redisClient.on('ready', () => {
            isConnected = true;
            console.log('✅ Redis reconnected');
        });

        redisClient.on('end', () => {
            isConnected = false;
        });
    }

    if (!isConnected) {
        const now = Date.now();
        if (now - lastConnectAttemptAt < RETRY_GAP_MS) {
            return null;
        }
        lastConnectAttemptAt = now;

        try {
            if (!redisClient.isOpen) {
                await redisClient.connect();
            }
            isConnected = true;
            console.log('✅ Redis connected');
        } catch (err) {
            console.log('❌ Redis connection failed, continuing without cache');
            isConnected = false;
            return null;
        }
    }

    return isConnected ? redisClient : null;
};

module.exports = { getClient };
*/

// Local-only mode: every cache caller receives a safe cache miss.
const getClient = async () => null;

module.exports = { getClient };
