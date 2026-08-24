const videoService = require('./video.service');
const VideoModel = require('./video.model');
const appointmentService = require('../appointment/appointment.service');
const catchAsync = require('../../utils/catchAsync');
const logger = require('../../utils/logger');
const sendResponse = require('../../utils/sendResponse');

exports.userVideoRoom = catchAsync(async (req, res) => {
    const appointment = await videoService.validateVideoRoom(req.params.roomId, req.user.id);
    const participants = await videoService.getRoomParticipants(req.params.roomId);

    return sendResponse(res, 200, 'Video room loaded', {
        roomId: req.params.roomId,
        appointmentId: appointment.id,
        userId: req.user.id,
        userName: participants.patientName || 'Patient',
        doctorName: participants.doctorName || 'Doctor',
        userRole: 'user'
    });
});

exports.docVideoRoom = catchAsync(async (req, res) => {
    const appointment = await videoService.validateVideoRoom(req.params.roomId, req.user.id);
    const participants = await videoService.getRoomParticipants(req.params.roomId);

    return sendResponse(res, 200, 'Video room loaded', {
        roomId: req.params.roomId,
        appointment: {
            id: appointment.id,
            patientName: participants.patientName || 'Patient',
            doctorName: participants.doctorName || 'Doctor'
        },
        userId: req.user.id,
        userRole: 'doctor'
    });
});

exports.docDashboard = catchAsync(async (req, res) => {
    const appointment = await appointmentService.getUserActiveAppointment(req.user.id, 'doctor');
    const allAppointments = await appointmentService.getDoctorAllAppointments(req.user.id);

    return sendResponse(res, 200, 'Doctor dashboard loaded', {
        appointment,
        hasAppointment: !!appointment,
        allAppointments
    });
});

exports.startCall = catchAsync(async (req, res) => {
    const roomId = await videoService.startVideoCall(req.params.appointmentId, req.user.id);

    // Broadcast to patient's dashboard via Socket.IO
    const io = req.app.get('io');
    if (io) {
        try {
            const appointment = await VideoModel.getAppointmentForRoom(roomId);
            if (appointment) {
                const dashNsp = io.of('/dashboard');
                dashNsp.to(`dashboard:user:${appointment.user_id}`).emit('appointment-updated', {
                    appointmentId: appointment.id,
                    status: 'started',
                    roomId: roomId,
                    doctorName: appointment.doctor_name,
                    timestamp: new Date().toISOString()
                });
                dashNsp.to(`dashboard:doctor:${appointment.doctor_id}`).emit('appointment-updated', {
                    appointmentId: appointment.id,
                    status: 'started',
                    roomId: roomId,
                    patientName: appointment.patient_name,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            logger.warn('Failed to broadcast startCall to dashboard:', err.message);
        }
    }

    return sendResponse(res, 200, 'Call started', { roomId });
});

exports.userDashboard = catchAsync(async (req, res) => {
    const appointment = await appointmentService.getUserActiveAppointment(req.user.id, 'user');

    return sendResponse(res, 200, 'Patient dashboard loaded', {
        appointment,
        hasAppointment: !!appointment
    });
});

exports.docStartCall = catchAsync(async (req, res) => {
    const roomId = await videoService.startVideoCall(req.params.appointmentId, req.user.id);

    // Broadcast to patient's dashboard
    const io = req.app.get('io');
    if (io) {
        try {
            const appointment = await VideoModel.getAppointmentForRoom(roomId);
            if (appointment) {
                const dashNsp = io.of('/dashboard');
                dashNsp.to(`dashboard:user:${appointment.user_id}`).emit('appointment-updated', {
                    appointmentId: appointment.id,
                    status: 'started',
                    roomId: roomId,
                    doctorName: appointment.doctor_name,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            logger.warn('Failed to broadcast docStartCall to dashboard:', err.message);
        }
    }

    return sendResponse(res, 200, 'Call started', { roomId, userRole: 'doctor' });
});

exports.userJoinCall = catchAsync(async (req, res) => {
    const roomId = await videoService.joinVideoCall(req.params.appointmentId, req.user.id);
    return sendResponse(res, 200, 'Call joined', { roomId, userRole: 'patient' });
});

exports.saveNotes = catchAsync(async (req, res) => {
    const { roomId, notes } = req.body;

    await videoService.saveCallNotes(roomId, req.user.id, notes);
    return sendResponse(res, 200, 'Notes saved successfully', null);
});
