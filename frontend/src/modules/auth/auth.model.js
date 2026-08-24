const { pool } = require('../../config/database');

class AuthModel {
    static async findByPhone(phone, role) {
        const result = await pool.query(
            `SELECT * FROM users WHERE phone=$1 AND role=$2`, [phone, role]
        );
        return result.rows[0] || null;
    }

    static async findByPhoneAnyRole(phone) {
        const result = await pool.query(
            `SELECT id, phone, role FROM users WHERE phone=$1`, [phone]
        );
        return result.rows[0] || null;
    }

    static async createUser(phone, hashedPassword, role) {
        const result = await pool.query(
            `INSERT INTO users (phone, password, role) VALUES ($1, $2, $3) RETURNING id, phone`,
            [phone, hashedPassword, role]
        );
        const row = result.rows[0];
        return { id: row.id, phone: row.phone, role };
    }

    static async findUserById(id, role) {
        const result = await pool.query(
            `SELECT phone FROM users WHERE id = $1 AND role = $2`, [id, role]
        );
        return result.rows[0] || null;
    }

    static async hasUserProfile(userId) {
        const result = await pool.query(
            `SELECT 1 FROM user_profile WHERE user_id = $1 LIMIT 1`,
            [userId]
        );
        return result.rows.length > 0;
    }

    static async hasDoctorProfile(userId) {
        const result = await pool.query(
            `SELECT 1 FROM doc_profile WHERE doc_id = $1 LIMIT 1`,
            [userId]
        );
        return result.rows.length > 0;
    }

    static async storeRefreshToken(userId, role, token, expiresAt) {
        await pool.query(
            `INSERT INTO refresh_tokens (user_id, role, token, expires_at) VALUES ($1, $2, $3, $4)`,
            [userId, role, token, expiresAt]
        );
    }

    static async findValidRefreshToken(token, userId, role) {
        const result = await pool.query(
            `SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND role = $3
             AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP`,
            [token, userId, role]
        );
        return result.rows[0] || null;
    }

    static async revokeToken(token) {
        await pool.query(
            `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP WHERE token = $1`,
            [token]
        );
    }

    static async revokeAllUserTokens(userId, role) {
        await pool.query(
            `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND role = $2 AND revoked = FALSE`,
            [userId, role]
        );
    }
}

module.exports = AuthModel;
