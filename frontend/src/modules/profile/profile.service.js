const { getClient } = require('../../config/redis');
const ProfileModel = require('./profile.model');

class ProfileService {
    async getUserProfile(userId) {
        try {
            const client = await getClient();
            if (client) {
                const cached = await client.get(`user:profile:${userId}`);
                if (cached) return JSON.parse(cached);
            }
        } catch (err) { /* non-critical */ }

        const profile = await ProfileModel.findUserProfile(userId);

        if (profile) {
            try {
                const client = await getClient();
                if (client) {
                    await client.set(`user:profile:${userId}`, JSON.stringify(profile), { EX: 1800 });
                }
            } catch (err) { /* non-critical */ }
        }

        return profile;
    }

    async createOrUpdateUserProfile(userId, data) {
        await ProfileModel.upsertUserProfile(userId, data);

        try {
            const client = await getClient();
            if (client) await client.del(`user:profile:${userId}`);
        } catch (err) { /* non-critical */ }
    }

    async getDoctorProfile(docId) {
        try {
            const client = await getClient();
            if (client) {
                const cached = await client.get(`doctor:profile:${docId}`);
                if (cached) return JSON.parse(cached);
            }
        } catch (err) { /* non-critical */ }

        const profile = await ProfileModel.findDoctorProfile(docId);

        if (profile) {
            try {
                const client = await getClient();
                if (client) {
                    await client.set(`doctor:profile:${docId}`, JSON.stringify(profile), { EX: 1800 });
                }
            } catch (err) { /* non-critical */ }
        }

        return profile;
    }

    async createOrUpdateDoctorProfile(docId, data) {
        await ProfileModel.upsertDoctorProfile(docId, data);

        try {
            const client = await getClient();
            if (client) await client.del(`doctor:profile:${docId}`);
        } catch (err) { /* non-critical */ }
    }
}

module.exports = new ProfileService();
