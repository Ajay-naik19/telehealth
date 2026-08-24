const express = require('express');
const router = express.Router();
const appointmentController = require('./appointment.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { bookAppointmentSchema, appointmentIdParam, cancelAppointmentSchema, rescheduleSchema, paginationQuery } = require('./appointment.schema');
const { validate } = require('../../middleware/validation');

router.post('/appointments/book', authenticate, authorize('user'), validate(bookAppointmentSchema), appointmentController.bookAppointment);
router.get('/api/appointments/patient', authenticate, authorize('user'), appointmentController.getUserAppointments);
router.get('/api/appointments/doctor', authenticate, authorize('doctor'), appointmentController.getDoctorAppointments);
router.get('/api/appointments/doctor/all', authenticate, authorize('doctor'), appointmentController.getDoctorAllAppointments);
router.get('/api/doctors', authenticate, authorize('user'), appointmentController.getAvailableDoctors);
router.post('/appointments/:id/complete', authenticate, authorize('doctor'), validate(appointmentIdParam, 'params'), appointmentController.completeAppointment);
router.get('/api/appointments/:id/status', authenticate, validate(appointmentIdParam, 'params'), appointmentController.getAppointmentStatus);
router.get('/api/appointments/recent-prescription', authenticate, authorize('user'), appointmentController.getRecentPrescription);
router.post('/api/appointments/:id/cancel', authenticate, validate(appointmentIdParam, 'params'), validate(cancelAppointmentSchema), appointmentController.cancelAppointment);
router.get('/api/appointments/cancelled', authenticate, appointmentController.getCancelledAppointments);

// New routes for booking system
router.post('/api/appointments/:id/reschedule', authenticate, authorize('user'), validate(appointmentIdParam, 'params'), validate(rescheduleSchema), appointmentController.rescheduleAppointment);
router.get('/api/appointments/upcoming', authenticate, validate(paginationQuery, 'query'), appointmentController.getUpcomingAppointments);
router.get('/api/appointments/history', authenticate, validate(paginationQuery, 'query'), appointmentController.getAppointmentHistory);

module.exports = router;
