const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getClient } = require('../../config/redis');
const AuthModel = require('./auth.model');
const { AppError, AuthError, ValidationError } = require('../../utils/AppError');

class AuthService {
    _toApiRole(role) {
        return role === 'user' ? 'patient' : role;
    }

    validatePassword(password) {
        if (!password || password.length < 6) {
            throw new ValidationError('Password must be at least 6 characters');
        }
    }

    validatePasswordMatch(password, confirmPassword) {
        if (password !== confirmPassword) {
            throw new ValidationError('Passwords must match');
        }
    }

    async register(phone, password, role) {
        const phoneInUse = await AuthModel.findByPhoneAnyRole(phone);
        if (phoneInUse) throw new AppError('An account with this phone number already exists', 409);

        const hash = await bcrypt.hash(password, 10);
        return AuthModel.createUser(phone, hash, role);
    }

    async authenticate(phone, password, role) {
        const user = await AuthModel.findByPhone(phone, role);

        if (!user) {
            const otherRole = await AuthModel.findByPhoneAnyRole(phone);
            if (otherRole) {
                const roleLabel = otherRole.role === 'user' ? 'patient' : otherRole.role;
                throw new AuthError(`This phone number is registered as a ${roleLabel} account`);
            }
            throw new AuthError('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) throw new AuthError('Invalid credentials');

        return { id: user.id, phone: user.phone, role };
    }

    async generateTokens(user) {
        const accessToken = jwt.sign(
            { id: user.id, role: user.role },
            config.ACCESS_TOKEN_SECRET,
            { expiresIn: config.ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { id: user.id, role: user.role, type: 'refresh' },
            config.REFRESH_TOKEN_SECRET,
            { expiresIn: config.REFRESH_TOKEN_EXPIRY }
        );

        await AuthModel.storeRefreshToken(
            user.id, user.role, refreshToken,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        );

        return { accessToken, refreshToken };
    }

    async verifyAccessToken(token) {
        const payload = jwt.verify(token, config.ACCESS_TOKEN_SECRET);

        const isBlacklisted = await this._isTokenBlacklisted(token);
        if (isBlacklisted) throw new AuthError('Token revoked');

        return payload;
    }

    async verifyRefreshToken(refreshToken) {
        const payload = jwt.verify(refreshToken, config.REFRESH_TOKEN_SECRET);
        if (payload.type !== 'refresh') throw new AuthError('Invalid token type');

        const stored = await AuthModel.findValidRefreshToken(refreshToken, payload.id, payload.role);
        if (!stored) throw new AuthError('Invalid or revoked refresh token');

        const user = await AuthModel.findUserById(payload.id, payload.role);
        if (!user) throw new AuthError('User not found');

        return { id: payload.id, phone: user.phone, role: payload.role };
    }

    async revokeRefreshToken(token) {
        await AuthModel.revokeToken(token);
    }

    async revokeAllUserTokens(userId, role) {
        await AuthModel.revokeAllUserTokens(userId, role);
    }

    async hasCompletedProfile(userId, role) {
        return role === 'doctor'
            ? AuthModel.hasDoctorProfile(userId)
            : AuthModel.hasUserProfile(userId);
    }

    async buildSessionState(userId, role) {
        const profileComplete = await this.hasCompletedProfile(userId, role);

        return {
            userId,
            role: this._toApiRole(role),
            backendRole: role,
            profileComplete
        };
    }

    async signup(phone, password, confirmPassword, role) {
        this.validatePassword(password);
        this.validatePasswordMatch(password, confirmPassword);

        const user = await this.register(phone, password, role);
        const tokens = await this.generateTokens(user);
        const session = await this.buildSessionState(user.id, user.role);

        return { tokens, session };
    }

    async login(phone, password, role) {
        const user = await this.authenticate(phone, password, role);
        const tokens = await this.generateTokens(user);
        const session = await this.buildSessionState(user.id, user.role);

        return { tokens, session };
    }

    async refreshSession(refreshToken) {
        const user = await this.verifyRefreshToken(refreshToken);
        await this.revokeRefreshToken(refreshToken);

        const tokens = await this.generateTokens(user);
        const session = await this.buildSessionState(user.id, user.role);

        return { tokens, session };
    }

    async resolveSession(accessToken, refreshToken) {
        if (!accessToken && !refreshToken) {
            return { authenticated: false, clearCookies: false };
        }

        let user = null;
        let tokens = null;

        if (accessToken) {
            try {
                const payload = await this.verifyAccessToken(accessToken);
                user = { id: payload.id, role: payload.role };
            } catch (err) {
                user = null;
            }
        }

        if (!user && refreshToken) {
            try {
                const session = await this.refreshSession(refreshToken);
                user = { id: session.session.userId, role: session.session.backendRole };
                tokens = session.tokens;
            } catch (err) {
                return { authenticated: false, clearCookies: true };
            }
        }

        if (!user) {
            return { authenticated: false, clearCookies: true };
        }

        return {
            authenticated: true,
            clearCookies: false,
            tokens,
            session: await this.buildSessionState(user.id, user.role)
        };
    }

    async blacklistAccessToken(token) {
        try {
            const client = await getClient();
            if (!client) return;

            const payload = jwt.decode(token);
            if (!payload || !payload.exp) return;

            const ttl = payload.exp - Math.floor(Date.now() / 1000);
            if (ttl <= 0) return;

            await client.set(`bl:${token}`, '1', { EX: ttl });
        } catch (err) { /* non-critical */ }
    }

    async _isTokenBlacklisted(token) {
        try {
            const client = await getClient();
            if (!client) return false;

            const result = await client.get(`bl:${token}`);
            return result !== null;
        } catch (err) {
            return false;
        }
    }
}

module.exports = new AuthService();
