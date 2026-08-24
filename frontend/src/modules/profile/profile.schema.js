const { z } = require('zod');
const { GENDERS, BLOOD_GROUPS } = require('../../middleware/validation');

const userProfileSchema = z.object({
    fullName: z.string({ required_error: 'Full name is required' })
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name must be under 100 characters'),
    gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Gender must be male, female, or other' }) }),
    customGender: z.string().max(50).optional().default(''),
    dob: z.string({ required_error: 'Date of birth is required' })
        .min(1, 'Date of birth is required')
        .refine((val) => {
            const dob = new Date(val);
            if (isNaN(dob.getTime())) return false;
            if (dob > new Date()) return false;
            const today = new Date();
            const age = today.getFullYear() - dob.getFullYear() -
                (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
            return age >= 18;
        }, { message: 'You must be at least 18 years old' }),
    weight: z.coerce.number({ required_error: 'Weight is required' })
        .min(2, 'Weight must be at least 2 kg')
        .max(500, 'Weight must be under 500 kg'),
    height: z.coerce.number({ required_error: 'Height is required' })
        .min(30, 'Height must be at least 30 cm')
        .max(300, 'Height must be under 300 cm'),
    bloodGroup: z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Invalid blood group' }) }),
    allergies: z.string().max(500).optional().default('')
});

const doctorProfileSchema = z.object({
    fullName: z.string({ required_error: 'Full name is required' })
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name must be under 100 characters'),
    specialization: z.string({ required_error: 'Specialization is required' })
        .min(2, 'Specialization must be at least 2 characters')
        .max(100, 'Specialization must be under 100 characters'),
    experience: z.coerce.number({ required_error: 'Experience is required' })
        .int('Experience must be a whole number')
        .min(0, 'Experience cannot be negative')
        .max(70, 'Experience must be under 70 years'),
    qualification: z.string().max(200).optional().default(''),
    hospital: z.string().max(200).optional().default(''),
    bio: z.string().max(1000).optional().default('')
});

module.exports = { userProfileSchema, doctorProfileSchema };
