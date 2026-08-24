const appointmentService = require('./appointment.service');
const catchAsync = require('../../utils/catchAsync');
const logger = require('../../utils/logger');
const sendResponse = require('../../utils/sendResponse');

function broadcastDashboard(req, event, data) {
    const io = req.app.get('io');
    if (!io) return;
    try {
        const dashNsp = io.of('/dashboard');
        if (data.doctorId) {
            dashNsp.to(`dashboard:doctor:${data.doctorId}`).emit(event, data);
        }
        if (data.userId) {
            dashNsp.to(`dashboard:user:${data.userId}`).emit(event, data);
        }
    } catch (err) {
        logger.warn('Failed to broadcast dashboard event:', err.message);
    }
}

exports.bookAppointment = async (req, res) => {
    try {
        await appointmentService.bookAppointment(
            req.user.id, req.body.doctorId,
            req.body.appointment_date, req.body.appointment_time,
            req.body.lockToken, req.body.symptoms
        );

        // Broadcast to doctor's dashboard
        broadcastDashboard(req, 'appointment-updated', {
            status: 'booked',
            doctorId: req.body.doctorId,
            userId: req.user.id,
            patientName: req.user.name || req.user.username || 'Patient',
            appointmentDate: req.body.appointment_date,
            appointmentTime: req.body.appointment_time,
            timestamp: new Date().toISOString()
        });

        return sendResponse(res, 200, 'Appointment booked successfully!', null);
    } catch (err) {
        console.error('Appointment booking error:', err.message);

        const statusCode = err.statusCode || 500;
        return sendResponse(res, statusCode, err.message || 'Failed to book appointment', null);
    }
};

exports.getUserAppointments = catchAsync(async (req, res) => {
    const appointment = await appointmentService.getUserActiveAppointment(req.user.id, 'user');
    return sendResponse(res, 200, 'User appointment fetched successfully', { appointment: appointment || null });
});

exports.startAppointment = catchAsync(async (req, res) => {
    const result = await appointmentService.startAppointment(req.params.id, req.user.id);
    return sendResponse(res, 200, 'Appointment started successfully', { roomId: result.room_id });
});

exports.getDoctorAppointments = catchAsync(async (req, res) => {
    const appointment = await appointmentService.getUserActiveAppointment(req.user.id, 'doctor');
    return sendResponse(res, 200, 'Doctor appointment fetched successfully', { appointment: appointment || null });
});

exports.getDoctorAllAppointments = catchAsync(async (req, res) => {
    const appointments = await appointmentService.getDoctorAllAppointments(req.user.id);
    return sendResponse(res, 200, 'Doctor appointments fetched successfully', { appointments });
});

exports.getAvailableDoctors = catchAsync(async (req, res) => {
    const doctors = await appointmentService.getAvailableDoctors();
    return sendResponse(res, 200, 'Available doctors fetched successfully', doctors);
});

exports.completeAppointment = catchAsync(async (req, res) => {
    await appointmentService.completeAppointment(req.params.id, req.user.id);
    return sendResponse(res, 200, 'Appointment marked as completed', null);
});

exports.getAppointmentStatus = catchAsync(async (req, res) => {
    const status = await appointmentService.getAppointmentStatus(req.params.id, req.user.id, req.user.role);
    return sendResponse(res, 200, 'Appointment status fetched successfully', { status });
});

exports.getRecentPrescription = catchAsync(async (req, res) => {
    const appointment = await appointmentService.getRecentCompletedAppointment(req.user.id);
    if (!appointment) {
        return sendResponse(res, 404, 'No recent completed appointment found', null);
    }
    return sendResponse(res, 200, 'Recent prescription fetched successfully', {
        appointment: {
            id: appointment.id,
            room_id: appointment.room_id
        },
        roomId: appointment.room_id,
        appointmentId: appointment.id
    });
});

exports.cancelAppointment = async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await appointmentService.cancelAppointment(
            req.params.id, req.user.id, req.user.role, reason
        );

        // Broadcast cancellation to both dashboards
        broadcastDashboard(req, 'appointment-updated', {
            appointmentId: req.params.id,
            status: 'cancelled',
            cancelledBy: req.user.role,
            doctorId: result.doctorId,
            userId: result.userId,
            timestamp: new Date().toISOString()
        });

        return sendResponse(res, 200, result.message || 'Appointment cancelled successfully', null);
    } catch (err) {
        console.error('Cancel appointment error:', err);

        if (err.message.includes('not found')) {
            return sendResponse(res, 404, err.message, null);
        }
        if (err.message.includes('Cannot cancel') || err.message.includes('already cancelled')) {
            return sendResponse(res, 400, err.message, null);
        }

        return sendResponse(res, 500, err.message || 'Failed to cancel appointment', null);
    }
};

exports.getCancelledAppointments = catchAsync(async (req, res) => {
    const appointments = await appointmentService.getCancelledAppointments(req.user.id, req.user.role);
    return sendResponse(res, 200, 'Cancelled appointments fetched successfully', appointments);
});

exports.rescheduleAppointment = async (req, res) => {
    try {
        const result = await appointmentService.rescheduleAppointment(
            req.params.id,
            req.user.id,
            req.body.doctorId,
            req.body.appointment_date,
            req.body.appointment_time,
            req.body.lockToken,
            req.body.symptoms
        );
        return sendResponse(res, 200, 'Appointment rescheduled successfully', result);
    } catch (err) {
        console.error('Reschedule error:', err);
        const statusCode = err.statusCode || 500;
        return sendResponse(res, statusCode, err.message || 'Failed to reschedule appointment', null);
    }
};

exports.getUpcomingAppointments = catchAsync(async (req, res) => {
    const { page, limit } = req.validated?.query || { page: 1, limit: 10 };
    const appointments = await appointmentService.getUpcomingAppointments(req.user.id, req.user.role, page, limit);
    return sendResponse(res, 200, 'Upcoming appointments fetched successfully', { appointments });
});

exports.getAppointmentHistory = catchAsync(async (req, res) => {
    const { page, limit } = req.validated?.query || { page: 1, limit: 10 };
    const appointments = await appointmentService.getAppointmentHistory(req.user.id, req.user.role, page, limit);
    return sendResponse(res, 200, 'Appointment history fetched successfully', appointments);
});
