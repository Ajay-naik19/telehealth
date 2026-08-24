const { pool } = require('../config/database');

module.exports = function (io) {
    io.on('connection', (socket) => {
        console.log('New socket connection:', socket.id);

        socket.on('join-room', async ({ roomId, role }) => {
            try {
                socket.roomId = roomId;
                socket.role = role;

                socket.join(roomId);

                const room = io.sockets.adapter.rooms.get(roomId) || new Set();
                const roomSize = room.size;
                console.log(`${role} joined room ${roomId}, room size: ${roomSize}`);

                if (role === 'user') {
                    const doctorInRoom = Array.from(room).some(socketId => {
                        const clientSocket = io.sockets.sockets.get(socketId);
                        return clientSocket && clientSocket.role === 'doctor' && socketId !== socket.id;
                    });

                    console.log(`User joined, doctor in room: ${doctorInRoom}`);

                    socket.emit('user-joined', {
                        roomId,
                        message: doctorInRoom ? 'Doctor is ready' : 'Waiting for doctor...'
                    });

                    if (doctorInRoom) {
                        console.log('Notifying doctor that user is ready');
                        socket.to(roomId).emit('user-ready');
                    }
                } else if (role === 'doctor') {
                    const userInRoom = Array.from(room).some(socketId => {
                        const clientSocket = io.sockets.sockets.get(socketId);
                        return clientSocket && clientSocket.role === 'user' && socketId !== socket.id;
                    });

                    console.log(`Doctor joined, user in room: ${userInRoom}`);

                    socket.emit('doctor-joined', {
                        roomId,
                        message: userInRoom ? 'Patient is ready' : 'Waiting for patient...'
                    });

                    if (userInRoom) {
                        console.log('Notifying user that doctor is ready');
                        socket.to(roomId).emit('doctor-ready');
                    }
                }

            } catch (error) {
                console.error('Error in join-room:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        socket.on('doctor-end-call', async ({ roomId, appointmentId, notes }) => {
            try {
                await pool.query(
                    `UPDATE appointments 
                     SET status = 'completed', completed_at = NOW() 
                     WHERE room_id = $1 AND status = 'started'`,
                    [roomId]
                );

                if (notes && notes.trim()) {
                    await pool.query(
                        `INSERT INTO doctor_notes (room_id, appointment_id, notes, sent, created_at)
                         VALUES ($1, $2, $3, TRUE, NOW())
                         ON CONFLICT (room_id) 
                         DO UPDATE SET notes = EXCLUDED.notes, sent = TRUE, created_at = NOW()`,
                        [roomId, appointmentId, notes.trim()]
                    );
                }

                io.to(roomId).emit('call-ended-by-doctor', {
                    roomId,
                    appointmentId,
                    reason: notes || 'Doctor ended the consultation',
                    timestamp: new Date().toISOString()
                });

                io.to(roomId).emit('prescription-ready', {
                    roomId,
                    appointmentId,
                    message: 'Prescription is now available for download'
                });

                socket.emit('call-ended-confirmed', {
                    message: 'Call ended successfully'
                });

            } catch (error) {
                socket.emit('error', { message: 'Failed to end call properly' });
            }
        });

        socket.on('signal', ({ roomId, ...payload }) => {
            console.log(`Signal from ${socket.role} in room ${roomId}:`, Object.keys(payload));
            socket.to(roomId).emit('signal', { ...payload, from: socket.role });
        });

        socket.on('user-ready-ack', ({ roomId }) => {
            console.log(`User acknowledged ready in room ${roomId}`);
            socket.to(roomId).emit('user-ready-ack');
        });

        socket.on('user-mute-state', ({ roomId, isMuted }) => {
            socket.to(roomId).emit('user-mute-state', { isMuted });
        });

        socket.on('user-camera-state', ({ roomId, isVideoOff }) => {
            socket.to(roomId).emit('user-camera-state', { isVideoOff });
        });

        socket.on('doctor-mute-state', ({ roomId, isMuted }) => {
            socket.to(roomId).emit('doctor-mute-state', { isMuted });
        });

        socket.on('doctor-camera-state', ({ roomId, isVideoOff }) => {
            socket.to(roomId).emit('doctor-camera-state', { isVideoOff });
        });

        socket.on('disconnect', (reason) => {

            if (socket.roomId) {
                if (socket.role === 'user') {
                    socket.to(socket.roomId).emit('user-disconnected');
                } else if (socket.role === 'doctor') {
                    socket.to(socket.roomId).emit('doctor-disconnected');
                }

                setTimeout(() => {
                    const room = io.sockets.adapter.rooms.get(socket.roomId);
                    if (!room || room.size === 0) {
                        console.log(`Room ${socket.roomId} is now empty`);
                    }
                }, 1000);
            }
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });
};