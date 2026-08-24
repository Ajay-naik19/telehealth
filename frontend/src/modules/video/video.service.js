const VideoModel = require('./video.model');
const { AppError } = require('../../utils/AppError');
const { TIME_WINDOW } = require('../../config/socket');

class VideoService {
    async startVideoCall(appointmentId, doctorId) {
        // Validate time window before allowing call start (DISABLED - doctors can start calls anytime)
        // const withinWindow = await VideoModel.isWithinTimeWindow(
        //     appointmentId,
        //     TIME_WINDOW.BEFORE_MINUTES,
        //     TIME_WINDOW.AFTER_MINUTES
        // );
        // if (!withinWindow) {
        //     throw new AppError(
        //         `Cannot start call outside the appointment time window (${TIME_WINDOW.BEFORE_MINUTES} min before to ${TIME_WINDOW.AFTER_MINUTES} min after)`,
        //         400
        //     );
        // }

        const result = await VideoModel.startCall(appointmentId, doctorId);
        if (!result) throw new AppError('Failed to start video call', 400);
        return result.room_id;
    }

    async joinVideoCall(appointmentId, userId) {
        const result = await VideoModel.findRoomForUser(appointmentId, userId);
        if (!result) throw new AppError('Doctor has not started the call yet', 400);
        return result.room_id;
    }

    async saveCallNotes(roomId, doctorId, notes) {
        await VideoModel.saveNotes(roomId, doctorId, notes);
    }

    async getCallNotes(roomId) {
        const result = await VideoModel.findNotes(roomId);
        return result?.notes || '';
    }

    async validateVideoRoom(roomId, userId) {
        const appointment = await VideoModel.validateRoom(roomId, userId);
        if (!appointment) throw new AppError('Invalid video room', 404);
        if (appointment.status !== 'started') throw new AppError('Video call has ended', 400);
        return appointment;
    }

    async endVideoCall(roomId) {
        await VideoModel.endCall(roomId);
    }

    async getActiveVideoRoom(userId, role) {
        return VideoModel.findActiveRoom(userId, role);
    }

    async createVideoRoom(appointmentId, userId) {
        return VideoModel.createRoom(appointmentId, userId);
    }

    async getRoomParticipants(roomId) {
        const result = await VideoModel.findRoomParticipants(roomId);
        if (!result) throw new AppError('Room not found', 404);
        return {
            patientId: result.user_id,
            doctorId: result.doctor_id,
            patientName: result.patient_name || 'Patient',
            doctorName: result.doctor_name || 'Doctor'
        };
    }

    async endCallWithPrescription(roomId, appointmentId, notes) {
        return VideoModel.endCallWithPrescription(roomId, appointmentId, notes);
    }

    async getAppointmentByRoomId(roomId, userId, role) {
        return VideoModel.findAppointmentByRoom(roomId, userId, role);
    }

    // --- Production Video System Methods ---

    async validateRoomAccess(roomId, userId, role) {
        const appointment = await VideoModel.validateUserForRoom(roomId, userId, role);
        if (!appointment) {
            throw new AppError('You are not authorized to access this room', 403);
        }
        return appointment;
    }

    // validateTimeWindow (DISABLED - calls can be started anytime)
    // async validateTimeWindow(appointmentId) {
    //     const withinWindow = await VideoModel.isWithinTimeWindow(
    //         appointmentId,
    //         TIME_WINDOW.BEFORE_MINUTES,
    //         TIME_WINDOW.AFTER_MINUTES
    //     );
    //     if (!withinWindow) {
    //         throw new AppError('Video call is not available outside the appointment time window', 403);
    //     }
    //     return true;
    // }

    async saveCallMetadata(roomId, metadata) {
        return VideoModel.saveCallMetadata(roomId, metadata);
    }

    async getAppointmentForRoom(roomId) {
        return VideoModel.getAppointmentForRoom(roomId);
    }
}

module.exports = new VideoService();
