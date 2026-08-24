const { pool } = require('../config/database');
const crypto = require('crypto');

class VideoService {
    async startVideoCall(appointmentId, doctorId) {
        const roomId = crypto.randomUUID();

        const result = await pool.query(
            `UPDATE appointments
             SET room_id = $1, status = 'started'
             WHERE id = $2 AND doctor_id = $3
             RETURNING room_id`,
            [roomId, appointmentId, doctorId]
        );

        if (!result.rowCount) {
            throw new Error('Failed to start video call');
        }

        return result.rows[0].room_id;
    }

    async joinVideoCall(appointmentId, userId) {
        const result = await pool.query(
            `SELECT room_id
             FROM appointments
             WHERE id = $1
               AND user_id = $2
               AND status = 'started'`,
            [appointmentId, userId]
        );

        if (!result.rows.length) {
            throw new Error('Doctor has not started the call yet');
        }

        return result.rows[0].room_id;
    }

    async saveCallNotes(roomId, doctorId, notes) {
        await pool.query(
            `INSERT INTO doctor_notes (room_id, doctor_id, notes)
             VALUES ($1, $2, $3)
             ON CONFLICT (room_id)
             DO UPDATE SET notes = EXCLUDED.notes`,
            [roomId, doctorId, notes || ""]
        );
    }

    async getCallNotes(roomId) {
        const result = await pool.query(
            `SELECT notes, created_at
             FROM doctor_notes
             WHERE room_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [roomId]
        );

        return result.rows[0]?.notes || "";
    }

    async validateVideoRoom(roomId, userId) {
        const result = await pool.query(
            `SELECT id, status
             FROM appointments
             WHERE room_id = $1
               AND (user_id = $2 OR doctor_id = $3)`,
            [roomId, userId, userId]
        );

        if (!result.rows.length) {
            throw new Error('Invalid video room');
        }

        const appointment = result.rows[0];

        if (appointment.status !== 'started') {
            throw new Error('Video call has ended');
        }

        return appointment;
    }

    async endVideoCall(roomId) {
        await pool.query(
            `UPDATE appointments
             SET status = 'completed', completed_at = NOW()
             WHERE room_id = $1 AND status = 'started'`,
            [roomId]
        );
    }

    async getActiveVideoRoom(userId, role) {
        const isDoctor = role === 'doctor';
        const column = isDoctor ? 'doctor_id' : 'user_id';

        const result = await pool.query(
            `SELECT room_id, status
             FROM appointments
             WHERE ${column} = $1 AND status = 'started'
             LIMIT 1`,
            [userId]
        );

        return result.rows[0] || null;
    }

    async createVideoRoom(appointmentId, userId) {
        const roomId = crypto.randomUUID();

        await pool.query(
            `UPDATE appointments
             SET room_id = $1
             WHERE id = $2 AND user_id = $3`,
            [roomId, appointmentId, userId]
        );

        return roomId;
    }

    async getRoomParticipants(roomId) {
        const result = await pool.query(
            `SELECT 
                a.user_id,
                a.doctor_id,
                up.full_name as patient_name,
                dp.full_name as doctor_name
             FROM appointments a
             LEFT JOIN user_profile up ON up.user_id = a.user_id
             LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
             WHERE a.room_id = $1`,
            [roomId]
        );

        if (!result.rows.length) {
            throw new Error('Room not found');
        }

        return {
            patientId: result.rows[0].user_id,
            doctorId: result.rows[0].doctor_id,
            patientName: result.rows[0].patient_name || 'Patient',
            doctorName: result.rows[0].doctor_name || 'Doctor'
        };
    }
}

module.exports = new VideoService();