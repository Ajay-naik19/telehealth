const express = require('express');
const router = express.Router();
const profileController = require('./profile.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { userProfileSchema, doctorProfileSchema } = require('./profile.schema');
const { validate } = require('../../middleware/validation');

router.get('/patient/profile', authenticate, authorize('user'), profileController.getUserProfile);
router.post('/patient/profile', authenticate, authorize('user'), validate(userProfileSchema), profileController.createUserProfile);
router.get('/doctor/profile', authenticate, authorize('doctor'), profileController.getDoctorProfile);
router.post('/doctor/profile', authenticate, authorize('doctor'), validate(doctorProfileSchema), profileController.createDoctorProfile);
router.get('/patient/profile/edit', authenticate, authorize('user'), profileController.editUserProfileForm);
router.post('/patient/profile/edit', authenticate, authorize('user'), validate(userProfileSchema), profileController.updateUserProfile);
router.get('/doctor/profile/edit', authenticate, authorize('doctor'), profileController.editDoctorProfileForm);
router.post('/doctor/profile/edit', authenticate, authorize('doctor'), validate(doctorProfileSchema), profileController.updateDoctorProfile);

module.exports = router;
