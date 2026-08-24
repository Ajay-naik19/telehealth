const crypto = require('crypto');
const { getClient } = require('../../config/redis');
const { pool } = require('../../config/database');
const ScheduleModel = require('./schedule.model');
const { AppError } = require('../../utils/AppError');

const SLOT_DURATION_MINUTES = 30;
const LOCK_TTL_SECONDS = 300;
const ADVANCE_BOOKING_HOURS = 24;

class ScheduleService {
    /**
     * Get a doctor's weekly schedule and upcoming overrides.
     */
    async getDoctorSchedule(doctorId) {
        const weeklySchedule = await ScheduleModel.getWeeklySchedule(doctorId);

        const today = new Date();
        const twoYearsOut = new Date();
        twoYearsOut.setDate(today.getDate() + 730);

        const overrides = await ScheduleModel.getOverrides(
            doctorId,
            today.toISOString().split('T')[0],
            twoYearsOut.toISOString().split('T')[0]
        );

        return { weeklySchedule, overrides };
    }

    /**
     * Replace a doctor's weekly schedule within a transaction.
     */
    async updateDoctorSchedule(doctorId, schedules) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await ScheduleModel.deactivateAllSchedules(doctorId, client);

            for (const entry of schedules) {
                await ScheduleModel.upsertScheduleDay(doctorId, entry.dayOfWeek, entry.startTime, entry.endTime, client);
            }

            await client.query('COMMIT');

            return await ScheduleModel.getWeeklySchedule(doctorId);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Add a schedule override (holiday, custom hours).
     */
    async addOverride(doctorId, data) {
        return await ScheduleModel.createOverride(
            doctorId, data.date, 'unavailable',
            null, null, data.reason
        );
    }

    /**
     * Remove a schedule override. Throws 404 if not found or not owned.
     */
    async removeOverride(overrideId, doctorId) {
        const deleted = await ScheduleModel.deleteOverride(overrideId, doctorId);
        if (!deleted) {
            throw new AppError('Override not found', 404);
        }
        return deleted;
    }

    /**
     * Get available time slots for a doctor on a given date.
     * Merges schedule, overrides, booked slots, and Redis locks.
     */
    async getAvailableSlots(doctorId, date) {
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();

        // 1. Get weekly schedule for this day
        const fullSchedule = await ScheduleModel.getWeeklySchedule(doctorId);
        const weeklySchedule = fullSchedule.filter(s => s.day_of_week === dayOfWeek);

        // 2. Check overrides for this exact date
        const overrides = await ScheduleModel.getOverrides(doctorId, date, date);

        let timeRanges = [];

        if (overrides.length > 0) {
            const hasUnavailable = overrides.some(o => o.override_type === 'unavailable');
            if (hasUnavailable) {
                // Doctor is fully unavailable on this date
                return [];
            }

            const customOverrides = overrides.filter(o => o.override_type === 'custom');
            if (customOverrides.length > 0) {
                // Use custom override hours instead of regular schedule
                timeRanges = customOverrides.map(o => ({
                    startTime: o.start_time.substring(0, 5),
                    endTime: o.end_time.substring(0, 5)
                }));
            }
        }

        // Fall back to regular weekly schedule if no custom overrides
        if (timeRanges.length === 0) {
            if (!weeklySchedule || weeklySchedule.length === 0) {
                return [];
            }
            timeRanges = weeklySchedule.map(s => ({
                startTime: s.start_time.substring(0, 5),
                endTime: s.end_time.substring(0, 5)
            }));
        }

        // 3. Generate 30-minute slots from all time ranges
        const allSlots = [];
        for (const range of timeRanges) {
            const slots = this._generateSlots(range.startTime, range.endTime);
            allSlots.push(...slots);
        }

        // 4. Get booked slots from DB
        const bookedSlots = await ScheduleModel.getBookedSlots(doctorId, date);
        const bookedSet = new Set(bookedSlots.map(t => t.substring(0, 5)));

        // 5. Get locked slots from Redis
        const lockedSet = await this._getLockedSlots(doctorId, date);

        // 6. Filter slots that are within the 24-hour advance booking window
        const now = new Date();
        const minBookableTime = new Date(now.getTime() + ADVANCE_BOOKING_HOURS * 60 * 60 * 1000);

        // 7. Build result with status
        const result = [];
        for (const time of allSlots) {
            const slotDateTime = new Date(`${date}T${time}`);
            if (slotDateTime <= minBookableTime) {
                continue; // Skip slots within 24-hour window
            }

            let status = 'available';
            if (bookedSet.has(time)) {
                status = 'booked';
            } else if (lockedSet.has(time)) {
                status = 'locked';
            }

            result.push({ time, status });
        }

        return result;
    }

    /**
     * Get all doctors that have active schedules.
     */
    async getAvailableDoctors() {
        return await ScheduleModel.getDoctorsWithSchedules();
    }

    /**
     * Lock a slot in Redis using SET NX EX. Returns lockToken on success.
     * Throws 409 if the slot is already locked.
     */
    async lockSlot(doctorId, date, time, userId) {
        const key = `slot:lock:${doctorId}:${date}:${time}`;
        const lockToken = crypto.randomUUID();
        const value = JSON.stringify({ userId, lockToken, lockedAt: Date.now() });

        try {
            const client = await getClient();
            if (!client) {
                // Redis unavailable - allow booking without lock
                return lockToken;
            }

            const acquired = await client.set(key, value, { NX: true, EX: LOCK_TTL_SECONDS });
            if (!acquired) {
                throw new AppError('Slot is currently being booked by another user', 409);
            }

            return lockToken;
        } catch (err) {
            if (err instanceof AppError) throw err;
            console.error('Redis lockSlot error (non-critical):', err.message);
            return lockToken;
        }
    }

    /**
     * Unlock a slot if the lockToken matches.
     */
    async unlockSlot(doctorId, date, time, lockToken) {
        const key = `slot:lock:${doctorId}:${date}:${time}`;

        try {
            const client = await getClient();
            if (!client) return;

            const raw = await client.get(key);
            if (!raw) return;

            const data = JSON.parse(raw);
            if (data.lockToken === lockToken) {
                await client.del(key);
            }
        } catch (err) {
            console.error('Redis unlockSlot error (non-critical):', err.message);
        }
    }

    /**
     * Verify that a lock exists and matches the given lockToken.
     */
    async verifyLock(doctorId, date, time, lockToken) {
        const key = `slot:lock:${doctorId}:${date}:${time}`;

        try {
            const client = await getClient();
            // If Redis is unavailable, allow booking to proceed and rely on
            // PostgreSQL transactional conflict checks as the source of truth.
            if (!client) return true;

            const raw = await client.get(key);
            if (!raw) return false;

            const data = JSON.parse(raw);
            return data.lockToken === lockToken;
        } catch (err) {
            console.error('Redis verifyLock error (non-critical):', err.message);
            // Degrade gracefully when Redis check fails.
            return true;
        }
    }

    /**
     * Unconditionally delete a lock (used for post-booking cleanup).
     */
    async deleteLock(doctorId, date, time) {
        const key = `slot:lock:${doctorId}:${date}:${time}`;

        try {
            const client = await getClient();
            if (!client) return;
            await client.del(key);
        } catch (err) {
            console.error('Redis deleteLock error (non-critical):', err.message);
        }
    }

    // ── Private Helpers ────────────────────────────────────────────────

    /**
     * Generate 30-minute time slots between startTime and endTime.
     * @param {string} startTime - HH:MM
     * @param {string} endTime   - HH:MM
     * @returns {string[]} Array of HH:MM slot start times
     */
    _generateSlots(startTime, endTime) {
        const slots = [];
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currentMinutes + SLOT_DURATION_MINUTES <= endMinutes) {
            const hours = Math.floor(currentMinutes / 60);
            const mins = currentMinutes % 60;
            slots.push(
                `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
            );
            currentMinutes += SLOT_DURATION_MINUTES;
        }

        return slots;
    }

    /**
     * Scan Redis for all locked slots for a given doctor and date.
     * @returns {Set<string>} Set of locked time strings (HH:MM)
     */
    async _getLockedSlots(doctorId, date) {
        const lockedSet = new Set();

        try {
            const client = await getClient();
            if (!client) return lockedSet;

            const pattern = `slot:lock:${doctorId}:${date}:*`;
            let cursor = 0;

            do {
                const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = result.cursor;

                for (const key of result.keys) {
                    // Key format: slot:lock:{doctorId}:{date}:{time}
                    const parts = key.split(':');
                    const time = parts[parts.length - 1];
                    lockedSet.add(time);
                }
            } while (cursor !== 0);
        } catch (err) {
            console.error('Redis _getLockedSlots error (non-critical):', err.message);
        }

        return lockedSet;
    }
}

module.exports = new ScheduleService();
