// ── Enums ──
const ROLES = Object.freeze({ USER: 'user', DOCTOR: 'doctor', ADMIN: 'admin' });
const VALID_ROLES = Object.values(ROLES);

const APPOINTMENT_STATUS = Object.freeze({
    SCHEDULED: 'scheduled',
    STARTED: 'started',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
});
const VALID_STATUSES = Object.values(APPOINTMENT_STATUS);

const GENDERS = Object.freeze(['male', 'female', 'other']);
const BLOOD_GROUPS = Object.freeze(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']);
const RECORD_TYPES = Object.freeze(['general', 'prescription', 'lab_report', 'imaging', 'discharge_summary']);

// ── File validation constants ──
const ALLOWED_FILE_MIMES = Object.freeze([
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const ALLOWED_FILE_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Regex ──
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

// ── Validation middleware factory ──
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const data = source === 'body' ? req.body
            : source === 'params' ? req.params
            : source === 'query' ? req.query
            : req.body;

        const result = schema.safeParse(data);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                data: {
                    details: result.error.issues.map(i => ({
                        field: i.path.join('.'),
                        message: i.message
                    }))
                }
            });
        }

        if (!req.validated) req.validated = {};
        req.validated[source] = result.data;
        next();
    };
}

module.exports = {
    validate,
    ROLES,
    VALID_ROLES,
    APPOINTMENT_STATUS,
    VALID_STATUSES,
    GENDERS,
    BLOOD_GROUPS,
    RECORD_TYPES,
    ALLOWED_FILE_MIMES,
    ALLOWED_FILE_EXTENSIONS,
    MAX_FILE_SIZE,
    PHONE_REGEX
};
