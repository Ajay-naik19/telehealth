const { z } = require('zod');
const { PHONE_REGEX } = require('../../middleware/validation');

const signupSchema = z.object({
    phone: z.string({ required_error: 'Phone is required' })
        .regex(PHONE_REGEX, 'Invalid phone number format'),
    password: z.string({ required_error: 'Password is required' })
        .min(6, 'Password must be at least 6 characters'),
    confirmpassword: z.string({ required_error: 'Confirm password is required' })
}).passthrough().refine(data => data.password === data.confirmpassword, {
    message: 'Passwords do not match',
    path: ['confirmpassword']
});

const loginSchema = z.object({
    phone: z.string({ required_error: 'Phone is required' })
        .min(1, 'Phone is required'),
    password: z.string({ required_error: 'Password is required' })
        .min(1, 'Password is required')
}).passthrough();

module.exports = { signupSchema, loginSchema };
