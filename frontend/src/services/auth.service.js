const { pool } = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const { getClient } = require('../config/redis'); 

class AuthService {
    constructor() {
        this.ACCESS_TOKEN_SECRET = config.ACCESS_TOKEN_SECRET;
        this.REFRESH_TOKEN_SECRET = config.REFRESH_TOKEN_SECRET;
        this.ACCESS_TOKEN_EXPIRY = config.ACCESS_TOKEN_EXPIRY;
        this.REFRESH_TOKEN_EXPIRY = config.REFRESH_TOKEN_EXPIRY;
        this.redisClient = null;
    }
    async _getRedisClient() {
        if (!this.redisClient) {
            this.redisClient = await getClient();
        }
        return this.redisClient;
    }

    _userProfileKey(userId) {
        return `user:profile:${userId}`;
    }

    _doctorProfileKey(doctorId) {
        return `doctor:profile:${doctorId}`;
    }

    _validateRole(role) {
        const VALID_ROLES = ['user', 'doctor'];
        if (!VALID_ROLES.includes(role)) {
            throw new Error('Invalid role specified');
        }
        return role;
    }

    _getTableConfig(role) {
        return { table: 'users', idField: 'id' };
    }

    async registerUser(phone, password, role = 'user') {
        this._validateRole(role);

        const exists = await pool.query(
            `SELECT id FROM users WHERE phone=$1`,
            [phone]
        );

        if (exists.rows.length) {
            throw new Error('An account with this phone number already exists');
        }

        const hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));

        const result = await pool.query(
            `INSERT INTO users (phone, password, role) VALUES ($1, $2, $3) RETURNING id`,
            [phone, hash, role]
        );

        return {
            id: result.rows[0].id,
            phone,
            role
        };
    }

    async authenticateUser(phone, password, role = 'user') {
        this._validateRole(role);

        const result = await pool.query(
            `SELECT * FROM users WHERE phone=$1 AND role=$2`,
            [phone, role]
        );

        const user = result.rows[0];

        if (!user) {
            const anyRole = await pool.query(
                `SELECT role FROM users WHERE phone=$1`, [phone]
            );
            if (anyRole.rows.length) {
                const existingRole = anyRole.rows[0].role === 'user' ? 'patient' : anyRole.rows[0].role;
                throw new Error(`This phone number is registered as a ${existingRole} account`);
            }
            throw new Error('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new Error('Invalid credentials');
        }

        return {
            id: user.id,
            phone: user.phone,
            role
        };
    }

    async generateTokens(user) {
        const accessToken = jwt.sign(
            { id: user.id, role: user.role },
            this.ACCESS_TOKEN_SECRET,
            { expiresIn: this.ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { id: user.id, role: user.role, type: 'refresh' },
            this.REFRESH_TOKEN_SECRET,
            { expiresIn: this.REFRESH_TOKEN_EXPIRY }
        );

        await pool.query(
            `INSERT INTO refresh_tokens (user_id, role, token, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [user.id, user.role, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        );

        return { accessToken, refreshToken };
    }

    async verifyAccessToken(token) {
        try {
            return jwt.verify(token, this.ACCESS_TOKEN_SECRET);
        } catch (error) {
            return null;
        }
    }

    async verifyRefreshToken(refreshToken) {
        try {
            const refreshPayload = jwt.verify(refreshToken, this.REFRESH_TOKEN_SECRET);

            const result = await pool.query(
                `SELECT * FROM refresh_tokens 
                 WHERE token = $1 AND user_id = $2 AND role = $3 
                   AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP`,
                [refreshToken, refreshPayload.id, refreshPayload.role]
            );

            if (result.rows.length === 0) {
                throw new Error("Invalid or revoked refresh token");
            }

            const userQuery = await pool.query(
                `SELECT phone FROM users WHERE id = $1 AND role = $2`,
                [refreshPayload.id, refreshPayload.role]
            );

            if (userQuery.rows.length === 0) {
                throw new Error("User not found");
            }

            return {
                id: refreshPayload.id,
                phone: userQuery.rows[0].phone,
                role: refreshPayload.role
            };
        } catch (error) {
            throw new Error("Invalid refresh token");
        }
    }

    async revokeRefreshToken(token) {
        await pool.query(
            `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP 
             WHERE token = $1`,
            [token]
        );
    }

    async revokeAllUserTokens(userId, role) {
        await pool.query(
            `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP 
             WHERE user_id = $1 AND role = $2 AND revoked = FALSE`,
            [userId, role]
        );
    }

    async createUserProfile(userId, profileData) {
        const {
            fullName,
            gender,
            customGender,
            dob,
            weight,
            height,
            bloodGroup,
            allergies
        } = profileData;

        await pool.query(
            `INSERT INTO user_profile
             (user_id, full_name, gender, custom_gender, date_of_birth,
              weight_kg, height_cm, blood_group, allergies)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (user_id)
             DO UPDATE SET
                 full_name = EXCLUDED.full_name,
                 gender = EXCLUDED.gender,
                 custom_gender = EXCLUDED.custom_gender,
                 date_of_birth = EXCLUDED.date_of_birth,
                 weight_kg = EXCLUDED.weight_kg,
                 height_cm = EXCLUDED.height_cm,
                 blood_group = EXCLUDED.blood_group,
                 allergies = EXCLUDED.allergies`,
            [
                userId,
                fullName,
                gender,
                customGender || null,
                dob,
                weight,
                height,
                bloodGroup,
                allergies || null
            ]
        );
        try {
            const client = await this._getRedisClient();
            if (client) {
                await client.del(this._userProfileKey(userId));
            }
        } catch (err) {

            console.log('Redis cache invalidation failed (non-critical)');
        }
    }

    async createDoctorProfile(doctorId, profileData) {
        const {
            fullName,
            specialization,
            experience,
            qualification,
            hospital,
            bio
        } = profileData;

        await pool.query(
            `INSERT INTO doc_profile
             (doc_id, full_name, specialization, experience_years,
              qualification, hospital_name, bio)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (doc_id)
             DO UPDATE SET
                 full_name = EXCLUDED.full_name,
                 specialization = EXCLUDED.specialization,
                 experience_years = EXCLUDED.experience_years,
                 qualification = EXCLUDED.qualification,
                 hospital_name = EXCLUDED.hospital_name,
                 bio = EXCLUDED.bio`,
            [
                doctorId,
                fullName,
                specialization,
                experience,
                qualification || null,
                hospital || null,
                bio || null
            ]
        );

        try {
            const client = await this._getRedisClient();
            if (client) {
                await client.del(this._doctorProfileKey(doctorId));
            }
        } catch (err) {
            console.log('Redis cache invalidation failed (non-critical)');
        }
    }

    async getUserProfile(userId) {
        try {
            const client = await this._getRedisClient();
            if (client) {
                const cached = await client.get(this._userProfileKey(userId));
                if (cached) {
                    return JSON.parse(cached);
                }
            }
        } catch (err) {
    
            console.log('Redis cache read failed (non-critical)');
        }
        const result = await pool.query(
            `SELECT full_name, gender, custom_gender, date_of_birth,
                    weight_kg, height_cm, blood_group, allergies
             FROM user_profile
             WHERE user_id = $1`,
            [userId]
        );

        const profile = result.rows[0];

        if (profile) {
            try {
                const client = await this._getRedisClient();
                if (client) {
                    await client.set(
                        this._userProfileKey(userId),
                        JSON.stringify(profile),
                        { EX: 1800 }
                    );
                }
            } catch (err) {
                
            }
        }

        return profile;
    }


    async getDoctorProfile(doctorId) {
        try {
            const client = await this._getRedisClient();
            if (client) {
                const cached = await client.get(this._doctorProfileKey(doctorId));
                if (cached) {
                    return JSON.parse(cached);
                }
            }
        } catch (err) {
            console.log('Redis cache read failed (non-critical)');
        }
        const result = await pool.query(
            `SELECT full_name, specialization, experience_years,
                    qualification, hospital_name, bio
             FROM doc_profile
             WHERE doc_id = $1`,
            [doctorId]
        );

        const profile = result.rows[0];
        if (profile) {
            try {
                const client = await this._getRedisClient();
                if (client) {
                    await client.set(
                        this._doctorProfileKey(doctorId),
                        JSON.stringify(profile),
                        { EX: 1800 }
                    );
                }
            } catch (err) {
                
            }
        }

        return profile;
    }

    validatePassword(password) {
        if (!password || password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        return true;
    }

    validatePasswordMatch(password, confirmPassword) {
        if (password !== confirmPassword) {
            throw new Error('Passwords must match');
        }
        return true;
    }
}

module.exports = new AuthService();