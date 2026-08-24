const express = require('express');
const router = express.Router();
const scheduleController = require('./schedule.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const {
    updateScheduleSchema,
    addOverrideSchema,
    deleteOverrideParam,
    getAvailableSlotsQuery,
    lockSlotSchema,
    unlockSlotSchema
} = require('./schedule.schema');

// Doctor schedule management
router.get('/api/schedule/my', authenticate, authorize('doctor'), scheduleController.getDoctorSchedule);
router.put('/api/schedule/my', authenticate, authorize('doctor'), validate(updateScheduleSchema), scheduleController.updateDoctorSchedule);
router.post('/api/schedule/override', authenticate, authorize('doctor'), validate(addOverrideSchema), scheduleController.addOverride);
router.delete('/api/schedule/override/:id', authenticate, authorize('doctor'), validate(deleteOverrideParam, 'params'), scheduleController.removeOverride);

// Patient slot browsing and locking
router.get('/api/slots', authenticate, authorize('user'), validate(getAvailableSlotsQuery, 'query'), scheduleController.getAvailableSlots);
router.get('/api/doctors/available', authenticate, authorize('user'), scheduleController.getAvailableDoctors);
router.post('/api/slots/lock', authenticate, authorize('user'), validate(lockSlotSchema), scheduleController.lockSlot);
router.post('/api/slots/unlock', authenticate, authorize('user'), validate(unlockSlotSchema), scheduleController.unlockSlot);

module.exports = router;
