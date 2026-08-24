const { pool } = require('../../config/database');
const crypto = require('crypto');

class VideoModel {
    static async startCall(appointmentId, doctorId) {
        const roomId = crypto.randomUUID();
        const result = await pool.query(
            `UPDATE appointments SET room_id = $1, status = 'started'
             WHERE id = $2 AND doctor_id = $3 RETURNING room_id`,
            [roomId, appointmentId, doctorId]
        );
        return result.rows[0] || null;
    }

    static async findRoomForUser(appointmentId, userId) {
        const result = await pool.query(
            `SELECT room_id FROM appointments
             WHERE id = $1 AND user_id = $2 AND status = 'started'`,
            [appointmentId, userId]
        );
        return result.rows[0] || null;
    }

    static async saveNotes(roomId, doctorId, notes) {
        await pool.query(
            `INSERT INTO doctor_notes (room_id, doctor_id, notes)
             VALUES ($1, $2, $3)
             ON CONFLICT (room_id) DO UPDATE SET notes = EXCLUDED.notes`,
            [roomId, doctorId, notes || '']
        );
    }

    static async findNotes(roomId) {
        const result = await pool.query(
            `SELECT notes, created_at FROM doctor_notes
             WHERE room_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [roomId]
        );
        return result.rows[0] || null;
    }

    static async validateRoom(roomId, userId) {
        const result = await pool.query(
            `SELECT id, status FROM appointments
             WHERE room_id = $1 AND (user_id = $2 OR doctor_id = $3)`,
            [roomId, userId, userId]
        );
        return result.rows[0] || null;
    }

    static async endCall(roomId) {
        await pool.query(
            `UPDATE appointments SET status = 'completed', completed_at = NOW()
             WHERE room_id = $1 AND status = 'started'`,
            [roomId]
        );
    }

    static async findActiveRoom(userId, role) {
        const column = role === 'doctor' ? 'doctor_id' : 'user_id';
        const result = await pool.query(
            `SELECT room_id, status FROM appointments
             WHERE ${column} = $1 AND status = 'started' LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    static async createRoom(appointmentId, userId) {
        const roomId = crypto.randomUUID();
        await pool.query(
            `UPDATE appointments SET room_id = $1
             WHERE id = $2 AND user_id = $3`,
            [roomId, appointmentId, userId]
        );
        return roomId;
    }

    static async findRoomParticipants(roomId) {
        const result = await pool.query(
            `SELECT a.user_id, a.doctor_id,
                    up.full_name as patient_name,
                    dp.full_name as doctor_name
             FROM appointments a
             LEFT JOIN user_profile up ON up.user_id = a.user_id
             LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
             WHERE a.room_id = $1`,
            [roomId]
        );
        return result.rows[0] || null;
    }

    static async endCallWithPrescription(roomId, appointmentId, notes) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const noteText = (notes && notes.trim()) ? notes.trim() : 'No prescription notes provided.';
            await client.query(
                `INSERT INTO doctor_notes (room_id, appointment_id, notes, sent, created_at)
                 VALUES ($1, $2, $3, TRUE, NOW())
                 ON CONFLICT (room_id)
                 DO UPDATE SET notes = EXCLUDED.notes, sent = TRUE, created_at = NOW()`,
                [roomId, appointmentId, noteText]
            );

            await client.query(
                `UPDATE appointments SET status = 'completed', completed_at = NOW()
                 WHERE room_id = $1 AND id = $2`,
                [roomId, appointmentId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async findAppointmentByRoom(roomId, userId, role) {
        const condition = role === 'user' ? 'a.user_id = $2' : 'a.doctor_id = $2';
        const result = await pool.query(
            `SELECT a.id, a.user_id, a.doctor_id, a.appointment_date,
                    dp.full_name as doctor_name, dp.specialization,
                    dp.qualification, dp.hospital_name
             FROM appointments a
             LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
             WHERE a.room_id = $1 AND ${condition}`,
            [roomId, userId]
        );
        return result.rows[0] || null;
    }

    // --- Production Video System Methods ---

    static async validateUserForRoom(roomId, userId, role) {
        const column = role === 'doctor' ? 'doctor_id' : 'user_id';
        const result = await pool.query(
            `SELECT a.id, a.user_id, a.doctor_id, a.appointment_date,
                    a.appointment_time, a.status, a.room_id,
                    up.full_name as patient_name,
                    dp.full_name as doctor_name
             FROM appointments a
             LEFT JOIN user_profile up ON up.user_id = a.user_id
             LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
             WHERE a.room_id = $1 AND a.${column} = $2`,
            [roomId, userId]
        );
        return result.rows[0] || null;
    }

    static async isWithinTimeWindow(appointmentId, beforeMinutes, afterMinutes) {
        const result = await pool.query(
            `SELECT id FROM appointments
             WHERE id = $1
               AND (appointment_date + appointment_time)
                   BETWEEN (NOW() - make_interval(mins => $2))
                   AND (NOW() + make_interval(mins => $3))`,
            [appointmentId, beforeMinutes, afterMinutes]
        );
        return result.rows.length > 0;
    }

    static async saveCallMetadata(roomId, metadata) {
        const { duration, disconnectReason, startedAt, endedAt } = metadata;
        await pool.query(
            `UPDATE appointments
             SET call_started_at = $1, call_ended_at = $2,
                 call_duration_seconds = $3, disconnect_reason = $4
             WHERE room_id = $5`,
            [startedAt, endedAt, duration, disconnectReason, roomId]
        );
    }

    static async createCallSession(roomId, appointmentId, userId, doctorId) {
        const result = await pool.query(
            `INSERT INTO call_sessions (room_id, appointment_id, user_id, doctor_id, state)
             VALUES ($1, $2, $3, $4, 'scheduled')
             ON CONFLICT (room_id) DO UPDATE SET updated_at = NOW()
             RETURNING id`,
            [roomId, appointmentId, userId, doctorId]
        );
        return result.rows[0];
    }

    static async updateCallSession(roomId, updates) {
        const ALLOWED_COLUMNS = ['state', 'call_started_at', 'call_ended_at', 'call_duration_seconds', 'disconnect_reason', 'doctor_joined_at', 'patient_joined_at'];
        const setClauses = [];
        const values = [roomId];
        let paramIdx = 2;

        for (const [key, value] of Object.entries(updates)) {
            if (!ALLOWED_COLUMNS.includes(key)) continue;
            setClauses.push(`${key} = $${paramIdx}`);
            values.push(value);
            paramIdx++;
        }
        if (setClauses.length === 0) return;
        setClauses.push('updated_at = NOW()');

        await pool.query(
            `UPDATE call_sessions SET ${setClauses.join(', ')} WHERE room_id = $1`,
            values
        );
    }

    static async getAppointmentForRoom(roomId) {
        const result = await pool.query(
            `SELECT a.id, a.user_id, a.doctor_id, a.appointment_date,
                    a.appointment_time, a.status, a.room_id,
                    up.full_name as patient_name,
                    dp.full_name as doctor_name
             FROM appointments a
             LEFT JOIN user_profile up ON up.user_id = a.user_id
             LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
             WHERE a.room_id = $1`,
            [roomId]
        );
        return result.rows[0] || null;
    }
}

module.exports = VideoModel;
