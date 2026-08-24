const { z } = require('zod');

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleItemSchema = z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'Time must be HH:MM format'),
    endTime: z.string().regex(timeRegex, 'Time must be HH:MM format')
});

const updateScheduleSchema = z.object({
    schedules: z.array(scheduleItemSchema).min(0).max(7)
});

const addOverrideSchema = z.object({
    date: z.string().min(1, 'Date is required'),
    reason: z.string().trim().min(1, 'Reason is required').max(255, 'Reason must be at most 255 characters')
});

const deleteOverrideParam = z.object({
    id: z.coerce.number().int().positive()
});

const getAvailableSlotsQuery = z.object({
    doctorId: z.coerce.number().int().positive(),
    date: z.string().min(1, 'Date is required')
});

const lockSlotSchema = z.object({
    doctorId: z.coerce.number().int().positive(),
    date: z.string().min(1),
    time: z.string().regex(timeRegex)
});

const unlockSlotSchema = z.object({
    doctorId: z.coerce.number().int().positive(),
    date: z.string().min(1),
    time: z.string().regex(timeRegex),
    lockToken: z.string().uuid()
});

module.exports = {
    updateScheduleSchema,
    addOverrideSchema,
    deleteOverrideParam,
    getAvailableSlotsQuery,
    lockSlotSchema,
    unlockSlotSchema
};
