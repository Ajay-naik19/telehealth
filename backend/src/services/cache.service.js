const { getClient } = require('../config/redis');

const CACHE_KEYS = {
    DOCTORS_LIST: 'doctors:list',
    USER_PROFILE: (userId) => `user:profile:${userId}`,
    DOCTOR_PROFILE: (doctorId) => `doctor:profile:${doctorId}`
};

const TTL = {
    DOCTORS_LIST: 300,    
    PROFILES: 1800         
};

class CacheService {
    async getDoctorsList() {
        try {
            const client = await getClient();
            if (!client) return null;
            const cached = await client.get(CACHE_KEYS.DOCTORS_LIST);
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null; 
        }
    }

    async setDoctorsList(doctors) {
        try {
            const client = await getClient();
            if (!client) return;
            await client.set(
                CACHE_KEYS.DOCTORS_LIST,
                JSON.stringify(doctors),
                { EX: TTL.DOCTORS_LIST }
            );
        } catch {
            
        }
    }

    async invalidateDoctorsList() {
        try {
            const client = await getClient();
            if (!client) return;
            await client.del(CACHE_KEYS.DOCTORS_LIST);
        } catch {
            
        }
    }


    async getUserProfile(userId) {
        try {
            const client = await getClient();
            if (!client) return null;
            const cached = await client.get(CACHE_KEYS.USER_PROFILE(userId));
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    }

    async setUserProfile(userId, profile) {
        try {
            const client = await getClient();
            if (!client) return;
            await client.set(
                CACHE_KEYS.USER_PROFILE(userId),
                JSON.stringify(profile),
                { EX: TTL.PROFILES }
            );
        } catch {
            
        }
    }

    async invalidateUserProfile(userId) {
        try {
            const client = await getClient();
            if (!client) return;
            await client.del(CACHE_KEYS.USER_PROFILE(userId));
        } catch {
           
        }
    }

    async getDoctorProfile(doctorId) {
        try {
            const client = await getClient();
            if (!client) return null;
            const cached = await client.get(CACHE_KEYS.DOCTOR_PROFILE(doctorId));
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    }

    async setDoctorProfile(doctorId, profile) {
        try {
            const client = await getClient();
            if (!client) return;
            await client.set(
                CACHE_KEYS.DOCTOR_PROFILE(doctorId),
                JSON.stringify(profile),
                { EX: TTL.PROFILES }
            );
        } catch {
            
        }
    }

    async invalidateDoctorProfile(doctorId) {
        try {
            const client = await getClient();
            if (!client) return;
            await client.del(CACHE_KEYS.DOCTOR_PROFILE(doctorId));
        } catch {
           
        }
    }
}

module.exports = new CacheService();