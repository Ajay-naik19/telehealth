const { z } = require('zod');

const bookAppointmentSchema = z.object({
    doctorId: z.coerce.number({ required_error: 'Doctor ID is required' })
        .int('Doctor ID must be an integer')
        .positive('Doctor ID must be positive'),
    appointment_date: z.string({ required_error: 'Date is required' })
        .min(1, 'Date is required'),
    appointment_time: z.string({ required_error: 'Time is required' })
        .min(1, 'Time is required'),
    lockToken: z.string().uuid().optional(),
    symptoms: z.string().max(1000, 'Symptoms must be under 1000 characters').optional().default('')
});

const appointmentIdParam = z.object({
    id: z.coerce.number({ required_error: 'Appointment ID is required' })
        .int('Appointment ID must be an integer')
        .positive('Appointment ID must be positive')
});

const cancelAppointmentSchema = z.object({
    reason: z.string().max(500).optional().default('')
});

const rescheduleSchema = z.object({
    doctorId: z.coerce.number().int().positive('Doctor ID must be positive'),
    appointment_date: z.string().min(1, 'Date is required'),
    appointment_time: z.string().min(1, 'Time is required'),
    lockToken: z.string().uuid().optional(),
    symptoms: z.string().max(1000, 'Symptoms must be under 1000 characters').optional().default('')
});

const paginationQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10)
});

module.exports = {
    bookAppointmentSchema,
    appointmentIdParam,
    cancelAppointmentSchema,
    rescheduleSchema,
    paginationQuery
};
