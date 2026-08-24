const { pool } = require('../../config/database');

class ProfileModel {
    static async findUserProfile(userId) {
        const result = await pool.query(
            `SELECT full_name, gender, custom_gender, date_of_birth,
                    weight_kg, height_cm, blood_group, allergies
             FROM user_profile WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    static async upsertUserProfile(userId, data) {
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
                data.fullName,
                data.gender,
                data.customGender || null,
                data.dob,
                data.weight,
                data.height,
                data.bloodGroup,
                data.allergies || null
            ]
        );
    }

    static async findDoctorProfile(docId) {
        const result = await pool.query(
            `SELECT full_name, specialization, experience_years,
                    qualification, hospital_name, bio
             FROM doc_profile WHERE doc_id = $1`,
            [docId]
        );
        return result.rows[0] || null;
    }

    static async upsertDoctorProfile(docId, data) {
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
                docId,
                data.fullName,
                data.specialization,
                data.experience,
                data.qualification || null,
                data.hospital || null,
                data.bio || null
            ]
        );
    }
}

module.exports = ProfileModel;
