const { getClient } = require('../../config/redis');
const VideoModel = require('./video.model');
const logger = require('../../utils/logger');

// Valid state transitions
const TRANSITIONS = {
    'scheduled': ['waiting'],
    'waiting': ['ongoing', 'completed'],
    'ongoing': ['completed'],
    'completed': []
};

class CallStateMachine {
    constructor() {
        this.REDIS_PREFIX = 'call:state:';
        this.REDIS_META_PREFIX = 'call:meta:';
        this.REDIS_GRACE_PREFIX = 'call:grace:';
    }

    _key(roomId) { return `${this.REDIS_PREFIX}${roomId}`; }
    _metaKey(roomId) { return `${this.REDIS_META_PREFIX}${roomId}`; }
    _graceKey(roomId, role) { return `${this.REDIS_GRACE_PREFIX}${roomId}:${role}`; }

    async getState(roomId) {
        try {
            const client = await getClient();
            if (client) {
                const state = await client.get(this._key(roomId));
                if (state) return state;
            }
        } catch (err) {
            logger.warn('Redis getState failed:', err.message);
        }
        // Fallback: derive from DB
        const appointment = await VideoModel.getAppointmentForRoom(roomId);
        if (!appointment) return null;
        if (appointment.status === 'started') return 'ongoing';
        return appointment.status;
    }

    async setState(roomId, newState, metadata = {}) {
        const currentState = await this.getState(roomId);

        // If there is a current state, validate transition
        if (currentState && !TRANSITIONS[currentState]?.includes(newState)) {
            logger.warn(`Invalid state transition: ${currentState} -> ${newState} for room ${roomId}`);
            throw new Error(`Invalid state transition: ${currentState} -> ${newState}`);
        }

        try {
            const client = await getClient();
            if (client) {
                await client.set(this._key(roomId), newState, { EX: 7200 }); // 2hr TTL

                // Store metadata
                if (Object.keys(metadata).length > 0) {
                    const existing = await this.getMetadata(roomId);
                    const merged = { ...existing, ...metadata, updatedAt: new Date().toISOString() };
                    await client.set(this._metaKey(roomId), JSON.stringify(merged), { EX: 7200 });
                }
            }
        } catch (err) {
            if (err.message.startsWith('Invalid state transition')) throw err;
            logger.warn('Redis setState failed:', err.message);
        }

        return newState;
    }

    async getMetadata(roomId) {
        try {
            const client = await getClient();
            if (client) {
                const data = await client.get(this._metaKey(roomId));
                return data ? JSON.parse(data) : {};
            }
        } catch (err) {
            logger.warn('Redis getMetadata failed:', err.message);
        }
        return {};
    }

    async setGraceTimeout(roomId, role, timeoutMs) {
        try {
            const client = await getClient();
            if (client) {
                const ttlSeconds = Math.ceil(timeoutMs / 1000);
                await client.set(
                    this._graceKey(roomId, role),
                    Date.now().toString(),
                    { EX: ttlSeconds }
                );
            }
        } catch (err) {
            logger.warn('Redis setGraceTimeout failed:', err.message);
        }
    }

    async clearGraceTimeout(roomId, role) {
        try {
            const client = await getClient();
            if (client) {
                await client.del(this._graceKey(roomId, role));
            }
        } catch (err) {
            logger.warn('Redis clearGraceTimeout failed:', err.message);
        }
    }

    async isInGracePeriod(roomId, role) {
        try {
            const client = await getClient();
            if (client) {
                const grace = await client.get(this._graceKey(roomId, role));
                return !!grace;
            }
        } catch (err) {
            logger.warn('Redis isInGracePeriod failed:', err.message);
        }
        return false;
    }

    async cleanup(roomId) {
        try {
            const client = await getClient();
            if (client) {
                await client.del(this._key(roomId));
                await client.del(this._metaKey(roomId));
                await client.del(this._graceKey(roomId, 'doctor'));
                await client.del(this._graceKey(roomId, 'user'));
            }
        } catch (err) {
            logger.warn('Redis cleanup failed:', err.message);
        }
    }
}

module.exports = new CallStateMachine();
