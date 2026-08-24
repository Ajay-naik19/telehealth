const { pool } = require('../../config/database');

class VaultModel {
    static async insertRecord(userId, fileName, filePath, recordType, uploadedAt) {
        const result = await pool.query(
            `INSERT INTO medical_records (user_id, file_name, file_path, record_type, uploaded_at)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [userId, fileName, filePath, recordType, uploadedAt]
        );
        return result.rows[0];
    }

    static async findByUser(userId) {
        const result = await pool.query(
            `SELECT id, file_name, record_type, uploaded_at, file_path
             FROM medical_records WHERE user_id = $1 ORDER BY uploaded_at DESC`,
            [userId]
        );
        return result.rows;
    }

    static async findById(fileId) {
        const result = await pool.query(
            `SELECT file_path, file_name, user_id FROM medical_records WHERE id = $1`,
            [fileId]
        );
        return result.rows[0] || null;
    }

    static async deleteRecord(fileId, userId, client) {
        const db = client || pool;
        await db.query('DELETE FROM medical_records WHERE id = $1 AND user_id = $2', [fileId, userId]);
    }

    static async findRecordForDelete(fileId, userId, client) {
        const db = client || pool;
        const result = await db.query(
            `SELECT file_path, user_id FROM medical_records WHERE id = $1 AND user_id = $2`,
            [fileId, userId]
        );
        return result.rows[0] || null;
    }

    static async checkDoctorPermission(doctorId, fileOwnerId) {
        const result = await pool.query(
            `SELECT a.id FROM appointments a
             WHERE a.doctor_id = $1 AND a.user_id = $2 AND a.records_allowed = true LIMIT 1`,
            [doctorId, fileOwnerId]
        );
        return result.rows.length > 0;
    }
}

module.exports = VaultModel;
