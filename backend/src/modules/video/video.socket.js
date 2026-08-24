const VideoModel = require('./video.model');
const callStateMachine = require('./video.statemachine');
const { GRACE_TIMEOUT_MS, TIME_WINDOW } = require('../../config/socket');
const logger = require('../../utils/logger');

// In-memory grace timeout handles (per-process, not shared across instances)
const graceTimers = new Map();

module.exports = function (io) {

    // ========== DASHBOARD NAMESPACE ==========
    const dashboardNsp = io.of('/dashboard');

    // Apply JWT auth middleware to dashboard namespace
    dashboardNsp.use((socket, next) => {
        try {
            const jwt = require('jsonwebtoken');
            const config = require('../../config');

            let token = socket.handshake.auth.token;
            if (!token) {
                const cookieHeader = socket.handshake.headers.cookie;
                if (cookieHeader) {
                    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                        const [key, value] = cookie.trim().split('=');
                        acc[key] = value;
                        return acc;
                    }, {});
                    token = cookies.accessToken;
                }
            }
            if (!token) return next(new Error('Authentication required'));

            const payload = jwt.verify(token, config.ACCESS_TOKEN_SECRET);
            socket.user = { id: payload.id, role: payload.role };
            next();
        } catch (error) {
            return next(new Error('Invalid token'));
        }
    });

    dashboardNsp.on('connection', (socket) => {
        const { id, role } = socket.user;
        socket.join(`dashboard:${role}:${id}`);
        logger.info(`Dashboard connected: ${role}:${id} (${socket.id})`);

        socket.on('disconnect', () => {
            logger.info(`Dashboard disconnected: ${role}:${id} (${socket.id})`);
        });
    });

    // ========== MAIN NAMESPACE (Video Calls) ==========
    io.on('connection', (socket) => {
        const user = socket.user; // Guaranteed non-null after auth middleware
        logger.info(`Socket connected: ${socket.id}, user: ${user.id}, role: ${user.role}`);

        // --- JOIN ROOM ---
        socket.on('join-room', async ({ roomId }) => {
            try {
                // 1. Use server-side role from JWT (not client-sent)
                const role = user.role;
                const userId = user.id;
                logger.info('Join-room requested', {
                    socketId: socket.id,
                    userId,
                    role,
                    roomId
                });

                // 2. Appointment-based access control: verify user is assigned
                const appointment = await VideoModel.validateUserForRoom(roomId, userId, role);
                if (!appointment) {
                    logger.warn(`Unauthorized room access: user ${userId} (${role}) for room ${roomId}`);
                    return socket.emit('error', { message: 'You are not authorized to access this room' });
                }

                // 3. Time window validation (DISABLED - calls can be started anytime)
                // const withinWindow = await VideoModel.isWithinTimeWindow(
                //     appointment.id, TIME_WINDOW.BEFORE_MINUTES, TIME_WINDOW.AFTER_MINUTES
                // );
                // if (!withinWindow) {
                //     logger.warn(`Time window violation: user ${userId} for appointment ${appointment.id}`);
                //     return socket.emit('error', { message: 'Video call is not available outside the appointment time window' });
                // }

                // 4. Store metadata on socket
                socket.roomId = roomId;
                socket.role = role;
                socket.userId = userId;
                socket.appointmentId = appointment.id;
                socket.join(roomId);

                // 5. Handle reconnection - clear grace timeout if exists
                const graceKey = `${roomId}:${role}`;
                if (graceTimers.has(graceKey)) {
                    clearTimeout(graceTimers.get(graceKey));
                    graceTimers.delete(graceKey);
                    await callStateMachine.clearGraceTimeout(roomId, role);
                    // Notify other party of reconnection
                    socket.to(roomId).emit('participant-reconnected', { role });
                    logger.info(`${role} reconnected to room ${roomId} within grace period`);
                }

                // 6. State machine transitions
                const currentState = await callStateMachine.getState(roomId);
                if (!currentState || currentState === 'scheduled') {
                    await callStateMachine.setState(roomId, 'waiting', {
                        [`${role}JoinedAt`]: new Date().toISOString()
                    });
                } else if (currentState === 'waiting') {
                    // Update join timestamp for this role
                    const meta = await callStateMachine.getMetadata(roomId);
                    if (!meta[`${role}JoinedAt`]) {
                        await callStateMachine.setState(roomId, 'waiting', {
                            [`${role}JoinedAt`]: new Date().toISOString()
                        });
                    }
                }

                // Check if both participants are now in the room
                const participants = getRoomParticipants(io, roomId);
                if (participants.doctor && participants.user) {
                    const state = await callStateMachine.getState(roomId);
                    if (state === 'waiting') {
                        await callStateMachine.setState(roomId, 'ongoing', {
                            callStartedAt: new Date().toISOString()
                        });
                        logger.info(`Call started in room ${roomId} - both participants present`);
                    }
                }

                // 7. Create call session record
                try {
                    await VideoModel.createCallSession(
                        roomId, appointment.id, appointment.user_id, appointment.doctor_id
                    );
                } catch (err) {
                    logger.warn('Failed to create call session:', err.message);
                }

                // 8. Emit join confirmation
                const otherRole = role === 'doctor' ? 'user' : 'doctor';
                const otherParticipant = participants[otherRole];

                socket.emit(`${role}-joined`, {
                    roomId,
                    appointmentId: appointment.id,
                    message: otherParticipant ? `${otherRole === 'doctor' ? 'Doctor' : 'Patient'} is ready` : `Waiting for ${otherRole === 'doctor' ? 'doctor' : 'patient'}...`
                });

                // 9. Notify other participant
                if (role === 'user') {
                    socket.to(roomId).emit('user-ready');
                } else {
                    socket.to(roomId).emit('doctor-ready');
                }

                // 10. Broadcast to dashboard namespace
                broadcastDashboardUpdate(io, appointment);

                logger.info(`${role} (${userId}) joined room ${roomId}, appointment ${appointment.id}`);

            } catch (error) {
                logger.error('Error in join-room:', error);
                socket.emit('error', { message: error.message || 'Failed to join room' });
            }
        });

        // --- SIGNALING (SDP offers/answers, ICE candidates) ---
        socket.on('signal', ({ roomId, ...payload }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('signal', { ...payload, from: socket.role });
        });

        // --- ICE RESTART REQUEST ---
        socket.on('ice-restart-request', ({ roomId }) => {
            if (socket.roomId !== roomId) return;
            logger.info(`ICE restart requested by ${socket.role} in room ${roomId}`);
            socket.to(roomId).emit('ice-restart-needed', { from: socket.role });
        });

        // --- MEDIA STATE (unified for both roles) ---
        socket.on('mute-state', ({ roomId, isMuted }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('participant-mute-state', { role: socket.role, isMuted });
        });

        socket.on('camera-state', ({ roomId, isVideoOff }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('participant-camera-state', { role: socket.role, isVideoOff });
        });

        // --- DOCTOR END CALL ---
        socket.on('doctor-end-call', async ({ roomId, appointmentId, notes }) => {
            if (socket.role !== 'doctor' || socket.roomId !== roomId) {
                return socket.emit('error', { message: 'Unauthorized: only the doctor can end the call' });
            }

            try {
                const meta = await callStateMachine.getMetadata(roomId);
                const callStartedAt = meta.callStartedAt ? new Date(meta.callStartedAt) : null;
                const callEndedAt = new Date();
                const duration = callStartedAt
                    ? Math.round((callEndedAt - callStartedAt) / 1000)
                    : 0;

                // Save prescription + complete appointment (existing transaction)
                await VideoModel.endCallWithPrescription(roomId, appointmentId, notes);

                // Save call metadata (non-critical)
                try {
                    await VideoModel.saveCallMetadata(roomId, {
                        duration,
                        disconnectReason: 'doctor_ended',
                        startedAt: callStartedAt,
                        endedAt: callEndedAt
                    });
                } catch (err) {
                    logger.warn('Failed to save call metadata:', err.message);
                }

                // Update call session (non-critical)
                try {
                    await VideoModel.updateCallSession(roomId, {
                        state: 'completed',
                        call_started_at: callStartedAt,
                        call_ended_at: callEndedAt,
                        call_duration_seconds: duration,
                        disconnect_reason: 'doctor_ended'
                    });
                } catch (err) {
                    logger.warn('Failed to update call session:', err.message);
                }

                // State machine -> completed (non-critical)
                try {
                    await callStateMachine.setState(roomId, 'completed', {
                        callEndedAt: callEndedAt.toISOString(),
                        duration,
                        endReason: 'doctor_ended'
                    });
                } catch (err) {
                    logger.warn('State transition to completed failed:', err.message);
                }

                // Notify patient
                io.to(roomId).emit('call-ended-by-doctor', {
                    roomId,
                    appointmentId,
                    reason: 'Doctor ended the consultation',
                    timestamp: callEndedAt.toISOString()
                });

                io.to(roomId).emit('prescription-ready', {
                    roomId,
                    appointmentId,
                    message: 'Prescription is now available for download'
                });

                // Confirm to doctor
                socket.emit('call-ended-confirmed', {
                    message: 'Call ended successfully',
                    duration
                });

                // Broadcast to dashboards (non-critical)
                try {
                    const appointment = await VideoModel.getAppointmentForRoom(roomId);
                    if (appointment) {
                        broadcastDashboardUpdate(io, { ...appointment, status: 'completed' });
                    }
                } catch (err) {
                    logger.warn('Failed to broadcast dashboard update:', err.message);
                }

                // Cleanup Redis state
                await callStateMachine.cleanup(roomId);

                // Clear any grace timers for this room
                graceTimers.delete(`${roomId}:doctor`);
                graceTimers.delete(`${roomId}:user`);

                logger.info(`Call ended by doctor in room ${roomId}, duration: ${duration}s`);

            } catch (error) {
                logger.error('Error ending call:', error);
                // Still confirm to doctor so the UI can proceed
                socket.emit('call-ended-confirmed', {
                    message: 'Call ended with warnings',
                    duration: 0
                });
            }
        });

        // --- LEGACY EVENT SUPPORT (backward compatibility) ---
        socket.on('user-mute-state', ({ roomId, isMuted }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('participant-mute-state', { role: 'user', isMuted });
            socket.to(roomId).emit('user-mute-state', { isMuted });
        });

        socket.on('user-camera-state', ({ roomId, isVideoOff }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('participant-camera-state', { role: 'user', isVideoOff });
            socket.to(roomId).emit('user-camera-state', { isVideoOff });
        });

        socket.on('doctor-mute-state', ({ roomId, isMuted }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('participant-mute-state', { role: 'doctor', isMuted });
            socket.to(roomId).emit('doctor-mute-state', { isMuted });
        });

        socket.on('doctor-camera-state', ({ roomId, isVideoOff }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('participant-camera-state', { role: 'doctor', isVideoOff });
            socket.to(roomId).emit('doctor-camera-state', { isVideoOff });
        });

        socket.on('user-ready-ack', ({ roomId }) => {
            if (socket.roomId !== roomId) return;
            socket.to(roomId).emit('user-ready-ack');
        });

        // --- DISCONNECT WITH GRACE TIMEOUT ---
        socket.on('disconnect', async (reason) => {
            if (!socket.roomId) return;

            const { roomId, role, appointmentId } = socket;
            logger.info(`${role} disconnected from room ${roomId}: ${reason}`);

            // Check if call is already completed
            const currentState = await callStateMachine.getState(roomId);
            if (currentState === 'completed') return;

            // Notify other participant about disconnection (with grace flag)
            socket.to(roomId).emit('participant-disconnected', {
                role,
                grace: true,
                graceMs: GRACE_TIMEOUT_MS
            });

            // Also emit legacy events for backward compat
            if (role === 'user') {
                socket.to(roomId).emit('user-disconnected');
            } else if (role === 'doctor') {
                socket.to(roomId).emit('doctor-disconnected');
            }

            // Start grace period
            const graceKey = `${roomId}:${role}`;
            await callStateMachine.setGraceTimeout(roomId, role, GRACE_TIMEOUT_MS);

            const timer = setTimeout(async () => {
                graceTimers.delete(graceKey);

                // Check if they reconnected (another socket in room with same role)
                const participants = getRoomParticipants(io, roomId);
                if (participants[role]) {
                    return; // They reconnected via a new socket
                }

                // Grace period expired - permanent disconnect
                logger.info(`Grace period expired for ${role} in room ${roomId}`);
                io.to(roomId).emit('participant-left', { role, permanent: true });

                await callStateMachine.clearGraceTimeout(roomId, role);

                // Update call session with disconnect info
                try {
                    await VideoModel.updateCallSession(roomId, {
                        disconnect_reason: `${role}_disconnected_permanent`
                    });
                } catch (err) {
                    logger.warn('Failed to update disconnect reason:', err.message);
                }
            }, GRACE_TIMEOUT_MS);

            graceTimers.set(graceKey, timer);
        });

        // --- SOCKET ERROR ---
        socket.on('error', (error) => {
            logger.error(`Socket error for ${user.role}:${user.id}:`, error);
        });
    });
};

// ========== HELPERS ==========

function getRoomParticipants(io, roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    const result = { doctor: null, user: null };
    if (!room) return result;

    for (const socketId of room) {
        const s = io.sockets.sockets.get(socketId);
        if (s && s.role === 'doctor') result.doctor = s;
        if (s && s.role === 'user') result.user = s;
    }
    return result;
}

function broadcastDashboardUpdate(io, appointment) {
    if (!appointment) return;
    const dashNsp = io.of('/dashboard');

    // Notify doctor's dashboard
    if (appointment.doctor_id) {
        dashNsp.to(`dashboard:doctor:${appointment.doctor_id}`).emit('appointment-updated', {
            appointmentId: appointment.id,
            status: appointment.status,
            roomId: appointment.room_id,
            patientName: appointment.patient_name,
            timestamp: new Date().toISOString()
        });
    }

    // Notify patient's dashboard
    if (appointment.user_id) {
        dashNsp.to(`dashboard:user:${appointment.user_id}`).emit('appointment-updated', {
            appointmentId: appointment.id,
            status: appointment.status,
            roomId: appointment.room_id,
            doctorName: appointment.doctor_name,
            timestamp: new Date().toISOString()
        });
    }
}
