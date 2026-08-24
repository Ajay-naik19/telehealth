const profileService = require('./profile.service');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');

function mapUserProfile(profile) {
    return {
        fullName: profile.full_name,
        gender: profile.gender,
        customGender: profile.custom_gender,
        dob: profile.date_of_birth,
        weight: profile.weight_kg,
        height: profile.height_cm,
        bloodGroup: profile.blood_group,
        allergies: profile.allergies
    };
}

function mapDoctorProfile(profile) {
    return {
        fullName: profile.full_name,
        specialization: profile.specialization,
        experience: profile.experience_years,
        qualification: profile.qualification,
        hospital: profile.hospital_name,
        bio: profile.bio
    };
}

exports.getUserProfile = catchAsync(async (req, res) => {
    const profile = await profileService.getUserProfile(req.user.id);

    if (!profile) {
        return sendResponse(res, 200, 'Profile not found', {
            profile: null,
            profileComplete: false
        });
    }

    return sendResponse(res, 200, 'Profile fetched successfully', {
        profile: mapUserProfile(profile),
        profileComplete: true
    });
});

exports.createUserProfile = catchAsync(async (req, res) => {
    const { fullName, gender, customGender, dob, weight, height, bloodGroup, allergies } = req.validated?.body || req.body;

    await profileService.createOrUpdateUserProfile(req.user.id, {
        fullName, gender, customGender, dob, weight, height, bloodGroup, allergies
    });

    return sendResponse(res, 200, 'Profile created', { profileComplete: true });
});

exports.getDoctorProfile = catchAsync(async (req, res) => {
    const profile = await profileService.getDoctorProfile(req.user.id);

    if (!profile) {
        return sendResponse(res, 200, 'Profile not found', {
            profile: null,
            profileComplete: false
        });
    }

    return sendResponse(res, 200, 'Profile fetched successfully', {
        profile: mapDoctorProfile(profile),
        profileComplete: true
    });
});

exports.createDoctorProfile = catchAsync(async (req, res) => {
    const { fullName, specialization, experience, qualification, hospital, bio } = req.validated?.body || req.body;

    await profileService.createOrUpdateDoctorProfile(req.user.id, {
        fullName, specialization, experience, qualification, hospital, bio
    });

    return sendResponse(res, 200, 'Profile created', { profileComplete: true });
});

exports.editUserProfileForm = catchAsync(async (req, res) => {
    const profile = await profileService.getUserProfile(req.user.id);

    if (!profile) {
        return sendResponse(res, 200, 'Profile not found', {
            profile: null,
            profileComplete: false
        });
    }

    return sendResponse(res, 200, 'Profile fetched successfully', {
        profile: mapUserProfile(profile),
        profileComplete: true
    });
});

exports.updateUserProfile = catchAsync(async (req, res) => {
    const { fullName, gender, customGender, dob, weight, height, bloodGroup, allergies } = req.validated?.body || req.body;

    await profileService.createOrUpdateUserProfile(req.user.id, {
        fullName, gender, customGender, dob, weight, height, bloodGroup, allergies
    });

    return sendResponse(res, 200, 'Profile updated', { profileComplete: true });
});

exports.editDoctorProfileForm = catchAsync(async (req, res) => {
    const profile = await profileService.getDoctorProfile(req.user.id);

    if (!profile) {
        return sendResponse(res, 200, 'Profile not found', {
            profile: null,
            profileComplete: false
        });
    }

    return sendResponse(res, 200, 'Profile fetched successfully', {
        profile: mapDoctorProfile(profile),
        profileComplete: true
    });
});

exports.updateDoctorProfile = catchAsync(async (req, res) => {
    const { fullName, specialization, experience, qualification, hospital, bio } = req.validated?.body || req.body;

    await profileService.createOrUpdateDoctorProfile(req.user.id, {
        fullName, specialization, experience, qualification, hospital, bio
    });

    return sendResponse(res, 200, 'Profile updated', { profileComplete: true });
});
