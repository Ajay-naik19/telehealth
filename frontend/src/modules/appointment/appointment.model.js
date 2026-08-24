const { pool } = require('../../config/database');
const crypto = require('crypto');

class AppointmentModel {
    static async findActiveByUser(userId) {
        const result = await pool.query(
            `SELECT id FROM appointments
             WHERE user_id = $1 AND status IN ('scheduled', 'approved', 'started') LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    static async create(userId, doctorId, date, time, client, symptoms) {
        const db = client || pool;
        const result = await db.query(
            `INSERT INTO appointments
             (user_id, doctor_id, appointment_date, appointment_time, status, symptoms)
             VALUES ($1, $2, $3, $4, 'scheduled', $5) RETURNING id`,
            [userId, doctorId, date, time, symptoms || null]
        );
        return result.rows[0];
    }

    static async startAppointment(appointmentId, doctorId) {
        const roomId = crypto.randomUUID();
        const result = await pool.query(
            `UPDATE appointments SET status = 'started', room_id = $1
             WHERE id = $2 AND doctor_id = $3 AND status = 'scheduled'
             RETURNING room_id`,
            [roomId, appointmentId, doctorId]
        );
        return result.rows[0] || null;
    }

    static async findByIdForDoctor(appointmentId, doctorId, client) {
        const db = client || pool;
        const result = await db.query(
            `SELECT id, appointment_date, appointment_time, status, room_id
             FROM appointments
             WHERE id = $1 AND doctor_id = $2
             LIMIT 1`,
            [appointmentId, doctorId]
        );
        return result.rows[0] || null;
    }

    static async findStartedForDoctor(doctorId, client) {
        const db = client || pool;
        const result = await db.query(
            `SELECT id
             FROM appointments
             WHERE doctor_id = $1 AND status = 'started'
             ORDER BY appointment_date ASC, appointment_time ASC
             LIMIT 1`,
            [doctorId]
        );
        return result.rows[0] || null;
    }

    static async findEarliestScheduledForDoctor(doctorId, client) {
        const db = client || pool;
        const result = await db.query(
            `SELECT id, appointment_date, appointment_time
             FROM appointments
             WHERE doctor_id = $1 AND status = 'scheduled'
             ORDER BY appointment_date ASC, appointment_time ASC
             LIMIT 1`,
            [doctorId]
        );
        return result.rows[0] || null;
    }

    static async completeAppointment(appointmentId, doctorId) {
        const result = await pool.query(
            `UPDATE appointments SET status = 'completed', completed_at = NOW()
             WHERE id = $1 AND doctor_id = $2 RETURNING id`,
            [appointmentId, doctorId]
        );
        return result.rows[0] || null;
    }

    static async getUserActiveAppointment(userId, role) {
        const isDoctor = role === 'doctor';
        const query = isDoctor
            ? `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.room_id,
                      COALESCE(up.full_name, 'Patient') AS user_name,
                      up.gender, up.weight_kg, up.height_cm, up.blood_group, up.allergies,
                      a.symptoms
               FROM appointments a
               LEFT JOIN user_profile up ON up.user_id = a.user_id
               WHERE a.doctor_id = $1 AND a.status IN ('scheduled','started')`
            : `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.room_id,
                      COALESCE(dp.full_name, 'Doctor') AS doctor_name,
                      COALESCE(dp.specialization, 'General') AS specialization
               FROM appointments a
               LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
               WHERE a.user_id = $1 AND a.status IN ('scheduled','started')`;

        const result = await pool.query(
            query + ` ORDER BY a.appointment_date, a.appointment_time LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    static async findAvailableDoctors() {
        const result = await pool.query(
            `SELECT d.id, p.full_name, p.specialization,
                    p.experience_years, p.qualification, p.hospital_name
             FROM users d
             JOIN doc_profile p ON p.doc_id = d.id
             WHERE d.role = 'doctor' AND NOT EXISTS (
                 SELECT 1 FROM appointments a
                 WHERE a.doctor_id = d.id
                 AND a.status IN ('started', 'scheduled')
                 AND a.appointment_date >= CURRENT_DATE
             )
             ORDER BY p.full_name`
        );
        return result.rows;
    }

    static async findStatus(appointmentId, userId, role) {
        const query = role === 'doctor'
            ? `SELECT status FROM appointments WHERE id = $1 AND doctor_id = $2`
            : `SELECT status FROM appointments WHERE id = $1 AND user_id = $2`;
        const result = await pool.query(query, [appointmentId, userId]);
        return result.rows[0] || null;
    }

    static async findRecentCompleted(userId) {
        const result = await pool.query(
            `SELECT a.id, a.room_id, a.completed_at
             FROM appointments a
             WHERE a.user_id = $1 AND a.status = 'completed' AND a.room_id IS NOT NULL
             ORDER BY a.completed_at DESC LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    static async findForCancel(appointmentId, userId, role, client) {
        const db = client || pool;
        const query = role === 'doctor'
            ? `SELECT id, user_id, doctor_id, status, appointment_date, appointment_time FROM appointments WHERE id = $1 AND doctor_id = $2`
            : `SELECT id, user_id, doctor_id, status, appointment_date, appointment_time FROM appointments WHERE id = $1 AND user_id = $2`;
        const result = await db.query(query, [appointmentId, userId]);
        return result.rows[0] || null;
    }

    static async updateCancel(appointmentId, reason, role, client) {
        const db = client || pool;
        await db.query(
            `UPDATE appointments SET status = 'cancelled', cancellation_reason = $1,
             cancelled_by = $2, cancelled_at = NOW() WHERE id = $3`,
            [reason || 'No reason provided', role, appointmentId]
        );
    }

    static async findCancelled(userId, role) {
        const query = role === 'doctor'
            ? `SELECT a.id, a.appointment_date, a.appointment_time, a.cancellation_reason,
                      a.cancelled_by, a.cancelled_at,
                      COALESCE(up.full_name, 'Patient') AS patient_name
               FROM appointments a
               LEFT JOIN user_profile up ON up.user_id = a.user_id
               WHERE a.doctor_id = $1 AND a.status = 'cancelled'
               ORDER BY a.cancelled_at DESC LIMIT 10`
            : `SELECT a.id, a.appointment_date, a.appointment_time, a.cancellation_reason,
                      a.cancelled_by, a.cancelled_at,
                      COALESCE(dp.full_name, 'Doctor') AS doctor_name
               FROM appointments a
               LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
               WHERE a.user_id = $1 AND a.status = 'cancelled'
               ORDER BY a.cancelled_at DESC LIMIT 10`;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async findDoctorAllAppointments(doctorId) {
        const result = await pool.query(
            `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.room_id,
                    COALESCE(up.full_name, 'Patient') AS user_name,
                    up.gender, up.weight_kg, up.height_cm, up.blood_group, up.allergies,
                    a.symptoms
             FROM appointments a
             LEFT JOIN user_profile up ON up.user_id = a.user_id
             WHERE a.doctor_id = $1 AND a.status IN ('scheduled', 'started')
             ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
            [doctorId]
        );
        return result.rows;
    }

    // --- New methods for production booking system ---

    static async findConflict(doctorId, date, time, client) {
        const db = client || pool;
        const result = await db.query(
            `SELECT id FROM appointments
             WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3
             AND status IN ('scheduled', 'started') LIMIT 1`,
            [doctorId, date, time]
        );
        return result.rows[0] || null;
    }

    static async acquireAdvisoryLock(doctorId, date, client) {
        const dateHash = date.replace(/-/g, '');
        const lockKey = doctorId * 1000000 + parseInt(dateHash.slice(-6), 10);
        await client.query('SET LOCAL lock_timeout = \'5s\'');
        await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
    }

    static async findForReschedule(appointmentId, userId, client) {
        const db = client || pool;
        const result = await db.query(
            `SELECT id, status, doctor_id, appointment_date, appointment_time
             FROM appointments
             WHERE id = $1 AND user_id = $2 AND status = 'scheduled'`,
            [appointmentId, userId]
        );
        return result.rows[0] || null;
    }

    static async findUpcoming(userId, role, limit, offset) {
        const isDoctor = role === 'doctor';
        const whereField = isDoctor ? 'a.doctor_id' : 'a.user_id';
        const joinClause = isDoctor
            ? 'LEFT JOIN user_profile up ON up.user_id = a.user_id'
            : 'LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id';
        const nameSelect = isDoctor
            ? "COALESCE(up.full_name, 'Patient') AS patient_name"
            : "COALESCE(dp.full_name, 'Doctor') AS doctor_name, COALESCE(dp.specialization, 'General') AS specialization";

        const result = await pool.query(
            `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.room_id, ${nameSelect}
             FROM appointments a
             ${joinClause}
             WHERE ${whereField} = $1 AND a.status IN ('scheduled', 'started')
             AND (a.appointment_date > CURRENT_DATE
                  OR (a.appointment_date = CURRENT_DATE AND a.appointment_time >= CURRENT_TIME))
             ORDER BY a.appointment_date, a.appointment_time
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows;
    }

    static async findHistory(userId, role, limit, offset) {
        const isDoctor = role === 'doctor';
        const whereField = isDoctor ? 'a.doctor_id' : 'a.user_id';
        const joinClause = isDoctor
            ? 'LEFT JOIN user_profile up ON up.user_id = a.user_id'
            : 'LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id';
        const nameSelect = isDoctor
            ? "COALESCE(up.full_name, 'Patient') AS patient_name"
            : "COALESCE(dp.full_name, 'Doctor') AS doctor_name, COALESCE(dp.specialization, 'General') AS specialization";

        const [dataResult, countResult] = await Promise.all([
            pool.query(
                `SELECT a.id, a.appointment_date, a.appointment_time, a.status, a.room_id,
                        a.cancellation_reason, a.cancelled_by, a.cancelled_at, a.completed_at,
                        ${nameSelect}
                 FROM appointments a
                 ${joinClause}
                 WHERE ${whereField} = $1 AND a.status IN ('completed', 'cancelled')
                 ORDER BY COALESCE(a.completed_at, a.cancelled_at) DESC
                 LIMIT $2 OFFSET $3`,
                [userId, limit, offset]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM appointments a
                 WHERE ${whereField} = $1 AND a.status IN ('completed', 'cancelled')`,
                [userId]
            )
        ]);

        return { rows: dataResult.rows, total: countResult.rows[0].total };
    }
}

module.exports = AppointmentModel;
