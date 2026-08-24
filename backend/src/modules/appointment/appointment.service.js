const { pool } = require('../../config/database');
const { getClient } = require('../../config/redis');
const AppointmentModel = require('./appointment.model');
const scheduleService = require('../schedule/schedule.service');
const { AppError } = require('../../utils/AppError');

const CANCEL_CUTOFF_HOURS = 2;
const ADVANCE_BOOKING_HOURS = 24;
const START_EARLY_WINDOW_MINUTES = 10;
const PAGE_SIZE = 10;

class AppointmentService {
    async _invalidateDoctorsCache() {
        try {
            const client = await getClient();
            if (client) {
                await client.del('doctors:list');
                await client.del('doctors:available');
            }
        } catch (err) { /* non-critical */ }
    }

    async bookAppointment(userId, doctorId, date, time, lockToken, symptoms) {
        // Enforce 24-hour advance booking
        const appointmentDateTime = new Date(`${date}T${time}`);
        const minBookingTime = new Date(Date.now() + ADVANCE_BOOKING_HOURS * 60 * 60 * 1000);
        if (appointmentDateTime <= minBookingTime) {
            throw new AppError('Appointments must be booked at least 24 hours in advance.', 400);
        }

        // Layer 1: Verify Redis lock ownership (if lockToken provided)
        if (lockToken) {
            const lockValid = await scheduleService.verifyLock(doctorId, date, time, lockToken);
            if (!lockValid) {
                throw new AppError('Slot lock expired or invalid. Please select the slot again.', 409);
            }
        }

        // Layer 2: PostgreSQL advisory lock + transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Advisory lock on doctor+date
            await AppointmentModel.acquireAdvisoryLock(doctorId, date, client);

            // Check if user already has an active appointment
            const existing = await client.query(
                `SELECT id FROM appointments
                 WHERE user_id = $1 AND status IN ('scheduled', 'approved', 'started') LIMIT 1`,
                [userId]
            );

            if (existing.rows.length > 0) {
                throw new AppError('You already have an active appointment. Cancel or complete it first.', 400);
            }

            // Check for slot conflict (Layer 2 check)
            const conflict = await AppointmentModel.findConflict(doctorId, date, time, client);
            if (conflict) {
                throw new AppError('This slot has already been booked. Please choose another.', 409);
            }

            // Layer 3: INSERT (partial unique index catches any remaining race)
            const result = await AppointmentModel.create(userId, doctorId, date, time, client, symptoms);

            await client.query('COMMIT');

            // Cleanup: delete Redis lock
            await scheduleService.deleteLock(doctorId, date, time);
            await this._invalidateDoctorsCache();

            return result;
        } catch (error) {
            await client.query('ROLLBACK');

            // Handle unique constraint violation (Layer 3 defense)
            if (error.code === '23505') {
                throw new AppError('This slot has already been booked. Please choose another.', 409);
            }
            // Handle advisory lock timeout
            if (error.code === '55P03') {
                throw new AppError('Server is busy processing bookings. Please try again.', 503);
            }

            throw error;
        } finally {
            client.release();
        }
    }

    async startAppointment(appointmentId, doctorId) {
        const target = await AppointmentModel.findByIdForDoctor(appointmentId, doctorId);
        if (!target) {
            throw new AppError('Appointment not found', 404);
        }

        if (target.status === 'started') {
            throw new AppError('Appointment is already started', 400);
        }

        if (target.status !== 'scheduled') {
            throw new AppError('Only scheduled appointments can be started', 400);
        }

        const inProgress = await AppointmentModel.findStartedForDoctor(doctorId);
        if (inProgress && Number(inProgress.id) !== Number(appointmentId)) {
            throw new AppError('Another appointment is already in progress. Complete it first.', 400);
        }

        const earliest = await AppointmentModel.findEarliestScheduledForDoctor(doctorId);
        if (earliest && Number(earliest.id) !== Number(appointmentId)) {
            throw new AppError('Start appointments in chronological order. Start the earliest one first.', 400);
        }

        const datePart = String(target.appointment_date || '').slice(0, 10);
        const timePart = String(target.appointment_time || '').slice(0, 8);
        const scheduledMs = new Date(`${datePart}T${timePart}`).getTime();
        if (Number.isFinite(scheduledMs)) {
            const earliestAllowedMs = scheduledMs - START_EARLY_WINDOW_MINUTES * 60 * 1000;
            if (Date.now() < earliestAllowedMs) {
                throw new AppError(`You can start this call only within ${START_EARLY_WINDOW_MINUTES} minutes of the scheduled time.`, 400);
            }
        }

        const result = await AppointmentModel.startAppointment(appointmentId, doctorId);
        if (!result) throw new AppError('Unable to start appointment. Please refresh and try again.', 409);
        return result;
    }

    async completeAppointment(appointmentId, doctorId) {
        const result = await AppointmentModel.completeAppointment(appointmentId, doctorId);
        if (!result) throw new AppError('Appointment not found', 404);
        await this._invalidateDoctorsCache();
        return result;
    }

    async getUserActiveAppointment(userId, role) {
        return AppointmentModel.getUserActiveAppointment(userId, role);
    }

    async getAvailableDoctors() {
        try {
            const redisClient = await getClient();
            if (redisClient) {
                const cached = await redisClient.get('doctors:available');
                if (cached) return JSON.parse(cached);
            }
        } catch (err) { /* non-critical */ }

        const doctors = await AppointmentModel.findAvailableDoctors();

        try {
            const redisClient = await getClient();
            if (redisClient) {
                await redisClient.set('doctors:available', JSON.stringify(doctors), { EX: 300 });
            }
        } catch (err) { /* non-critical */ }

        return doctors;
    }

    async getAppointmentStatus(appointmentId, userId, role) {
        const result = await AppointmentModel.findStatus(appointmentId, userId, role);
        if (!result) throw new AppError('Appointment not found', 404);
        return result.status;
    }

    async getRecentCompletedAppointment(userId) {
        return AppointmentModel.findRecentCompleted(userId);
    }

    async cancelAppointment(appointmentId, userId, role, reason) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const appointment = await AppointmentModel.findForCancel(appointmentId, userId, role, client);

            if (!appointment) throw new AppError('Appointment not found', 404);
            if (appointment.status === 'completed') throw new AppError('Cannot cancel a completed appointment', 400);
            if (appointment.status === 'cancelled') throw new AppError('Appointment is already cancelled', 400);
            if (appointment.status === 'started') throw new AppError('Cannot cancel an in-progress appointment', 400);

            // 2-hour cutoff check
            if (appointment.appointment_date && appointment.appointment_time) {
                const appointmentDateTime = new Date(
                    `${appointment.appointment_date}T${appointment.appointment_time}`
                );
                const cutoff = new Date(appointmentDateTime.getTime() - CANCEL_CUTOFF_HOURS * 60 * 60 * 1000);
                if (new Date() >= cutoff) {
                    throw new AppError(
                        `Cannot cancel within ${CANCEL_CUTOFF_HOURS} hours of the appointment time`,
                        400
                    );
                }
            }

            await AppointmentModel.updateCancel(appointmentId, reason, role, client);
            await client.query('COMMIT');
            await this._invalidateDoctorsCache();

            return {
                success: true,
                message: 'Appointment cancelled successfully',
                userId: appointment.user_id,
                doctorId: appointment.doctor_id
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async rescheduleAppointment(appointmentId, userId, newDoctorId, newDate, newTime, lockToken, symptoms) {
        // Enforce 24-hour advance booking for the new slot
        const newDateTime = new Date(`${newDate}T${newTime}`);
        const minBookingTime = new Date(Date.now() + ADVANCE_BOOKING_HOURS * 60 * 60 * 1000);
        if (newDateTime <= minBookingTime) {
            throw new AppError('Appointments must be booked at least 24 hours in advance.', 400);
        }

        // Verify lock for the new slot
        if (lockToken) {
            const lockValid = await scheduleService.verifyLock(newDoctorId, newDate, newTime, lockToken);
            if (!lockValid) {
                throw new AppError('Slot lock expired or invalid. Please select the slot again.', 409);
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Find old appointment
            const oldAppt = await AppointmentModel.findForReschedule(appointmentId, userId, client);
            if (!oldAppt) {
                throw new AppError('Appointment not found or not eligible for rescheduling', 404);
            }

            // 2-hour cutoff on old appointment
            const oldDateTime = new Date(
                `${oldAppt.appointment_date}T${oldAppt.appointment_time}`
            );
            const cutoff = new Date(oldDateTime.getTime() - CANCEL_CUTOFF_HOURS * 60 * 60 * 1000);
            if (new Date() >= cutoff) {
                throw new AppError(
                    `Cannot reschedule within ${CANCEL_CUTOFF_HOURS} hours of the original appointment`,
                    400
                );
            }

            // Advisory lock on new doctor+date
            await AppointmentModel.acquireAdvisoryLock(newDoctorId, newDate, client);

            // Check conflict on new slot
            const conflict = await AppointmentModel.findConflict(newDoctorId, newDate, newTime, client);
            if (conflict) {
                throw new AppError('New slot has already been booked. Please choose another.', 409);
            }

            // Cancel old appointment
            await AppointmentModel.updateCancel(appointmentId, 'Rescheduled', 'user', client);

            // Create new appointment
            const result = await AppointmentModel.create(userId, newDoctorId, newDate, newTime, client, symptoms);

            await client.query('COMMIT');

            // Cleanup
            await scheduleService.deleteLock(newDoctorId, newDate, newTime);
            await this._invalidateDoctorsCache();

            return { newAppointmentId: result.id, message: 'Appointment rescheduled successfully' };
        } catch (error) {
            await client.query('ROLLBACK');

            if (error.code === '23505') {
                throw new AppError('New slot has already been booked. Please choose another.', 409);
            }
            if (error.code === '55P03') {
                throw new AppError('Server is busy processing bookings. Please try again.', 503);
            }

            throw error;
        } finally {
            client.release();
        }
    }

    async getCancelledAppointments(userId, role) {
        return AppointmentModel.findCancelled(userId, role);
    }

    async getDoctorAllAppointments(doctorId) {
        return AppointmentModel.findDoctorAllAppointments(doctorId);
    }

    async getUpcomingAppointments(userId, role, page = 1, limit = PAGE_SIZE) {
        const offset = (page - 1) * limit;
        return AppointmentModel.findUpcoming(userId, role, limit, offset);
    }

    async getAppointmentHistory(userId, role, page = 1, limit = PAGE_SIZE) {
        const offset = (page - 1) * limit;
        const { rows, total } = await AppointmentModel.findHistory(userId, role, limit, offset);
        return { appointments: rows, totalPages: Math.ceil(total / limit) || 1 };
    }
}

module.exports = new AppointmentService();
