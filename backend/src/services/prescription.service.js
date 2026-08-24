const { pool } = require('../config/database');
const PDFDocument = require('pdfkit');

class PrescriptionService {
    async getPrescriptionData(roomId, userId, userRole) {
        let appointmentQuery;
        if (userRole === "user") {
            appointmentQuery = await pool.query(
                `SELECT a.id, a.user_id, a.doctor_id, a.appointment_date,
                        dp.full_name as doctor_name,
                        dp.specialization,
                        dp.qualification,
                        dp.hospital_name
                 FROM appointments a
                 LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                 WHERE a.room_id = $1 AND a.user_id = $2`,
                [roomId, userId]
            );
        } else if (userRole === "doctor") {
            appointmentQuery = await pool.query(
                `SELECT a.id, a.user_id, a.doctor_id, a.appointment_date,
                        dp.full_name as doctor_name,
                        dp.specialization,
                        dp.qualification,
                        dp.hospital_name
                 FROM appointments a
                 LEFT JOIN doc_profile dp ON dp.doc_id = a.doctor_id
                 WHERE a.room_id = $1 AND a.doctor_id = $2`,
                [roomId, userId]
            );
        }

        if (!appointmentQuery.rows.length) {
            throw new Error('Prescription not found');
        }

        const appointment = appointmentQuery.rows[0];

        const notesQuery = await pool.query(
            `SELECT notes, created_at
             FROM doctor_notes
             WHERE room_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [roomId]
        );

        let notes = "No prescription notes provided by the doctor.";
        let prescriptionDate = new Date();

        if (notesQuery.rows.length > 0) {
            notes = notesQuery.rows[0].notes || notes;
            prescriptionDate = notesQuery.rows[0].created_at || prescriptionDate;
        }

        let patientInfo = await this.getPatientInfo(
            userRole === 'doctor' ? appointment.user_id : userId
        );

        return {
            appointment,
            notes,
            prescriptionDate,
            patientInfo,
            roomId
        };
    }

    async getPatientInfo(patientId) {
        const patientQuery = await pool.query(
            `SELECT full_name, date_of_birth, gender, blood_group
             FROM user_profile
             WHERE user_id = $1`,
            [patientId]
        );

        if (!patientQuery.rows.length) {
            return {
                name: "Patient",
                info: "Patient: Patient"
            };
        }

        const patient = patientQuery.rows[0];
        let info = `Patient: ${patient.full_name || "Patient"}`;

        if (patient.date_of_birth) {
            const dob = new Date(patient.date_of_birth);
            const age = new Date().getFullYear() - dob.getFullYear();
            info += ` | Age: ${age} years`;
        }

        if (patient.gender) {
            info += ` | Gender: ${patient.gender}`;
        }

        if (patient.blood_group) {
            info += ` | Blood Group: ${patient.blood_group}`;
        }

        return {
            name: patient.full_name || "Patient",
            info
        };
    }

    async generatePDF(prescriptionData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    margin: 50,
                    size: 'A4',
                    info: {
                        Title: 'Medical Prescription',
                        Author: 'TeleHealth System',
                        Subject: 'Medical Consultation Prescription',
                        Keywords: 'prescription, medical, telehealth',
                        CreationDate: new Date()
                    }
                });

                const chunks = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.addPrescriptionContent(doc, prescriptionData);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    addPrescriptionContent(doc, data) {
        const { appointment, notes, prescriptionDate, patientInfo } = data;

        const doctorName = appointment.doctor_name || "Dr. Unknown";
        const specialization = appointment.specialization || "General Physician";
        const qualification = appointment.qualification || "MD";
        const hospital = appointment.hospital_name || "";

        const dateStr = new Date(prescriptionDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(`Dr. ${doctorName}`);

        doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#444')
            .text(`${qualification} | ${specialization}`);

        if (hospital) {
            doc.text(hospital);
        }

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);

        doc
            .fontSize(11)
            .fillColor('#000')
            .font('Helvetica-Bold')
            .text('Patient');

        doc
            .fontSize(10)
            .font('Helvetica')
            .text(patientInfo.info);

        doc.text(`Date: ${dateStr}`);

        doc.moveDown(1);

        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Prescription');

        doc.moveDown(0.5);

        doc
            .fontSize(11)
            .font('Helvetica')
            .fillColor('#000');

        const lines = notes.split('\n').filter(Boolean);

        lines.forEach(line => {
            doc.text(`• ${line.trim()}`, {
                indent: 10,
                lineGap: 4
            });
        });

        doc.moveDown(3);
        doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#444')
            .text(`Dr. ${doctorName}`, { align: 'right' });

        doc.text(`${qualification}`, { align: 'right' });
    }


    async savePrescriptionNotes(roomId, appointmentId, notes) {
        if (!notes || !notes.trim()) {
            notes = "No prescription notes provided.";
        }

        await pool.query(
            `INSERT INTO doctor_notes (room_id, appointment_id, notes, sent, created_at)
             VALUES ($1, $2, $3, TRUE, NOW())
             ON CONFLICT (room_id) 
             DO UPDATE SET 
                notes = EXCLUDED.notes, 
                sent = TRUE, 
                created_at = NOW()`,
            [roomId, appointmentId, notes]
        );
    }
}

module.exports = new PrescriptionService();