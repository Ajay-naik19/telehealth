const { z } = require('zod');
const { RECORD_TYPES } = require('../../middleware/validation');

const uploadSchema = z.object({
    recordType: z.enum(RECORD_TYPES, {
        errorMap: () => ({ message: `Record type must be one of: ${RECORD_TYPES.join(', ')}` })
    }).optional().default('general')
});

const fileIdParam = z.object({
    id: z.coerce.number({ required_error: 'File ID is required' })
        .int('File ID must be an integer')
        .positive('File ID must be positive')
});

module.exports = { uploadSchema, fileIdParam };
