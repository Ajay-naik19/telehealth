const { z } = require('zod');

const roomIdParam = z.object({
    roomId: z.string({ required_error: 'Room ID is required' })
        .min(1, 'Room ID is required')
});

const appointmentIdParam = z.object({
    appointmentId: z.coerce.number({ required_error: 'Appointment ID is required' })
        .int('Appointment ID must be an integer')
        .positive('Appointment ID must be positive')
});

const saveNotesSchema = z.object({
    roomId: z.string({ required_error: 'Room ID is required' })
        .min(1, 'Room ID is required'),
    notes: z.string().max(5000).optional().default('')
});

const joinRoomSchema = z.object({
    roomId: z.string({ required_error: 'Room ID is required' })
        .uuid('Room ID must be a valid UUID')
});

module.exports = { roomIdParam, appointmentIdParam, saveNotesSchema, joinRoomSchema };
