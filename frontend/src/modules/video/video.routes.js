const express = require('express');
const router = express.Router();
const videoController = require('./video.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { roomIdParam, appointmentIdParam, saveNotesSchema } = require('./video.schema');
const { validate } = require('../../middleware/validation');

// Video room entry
router.get('/patient/video/:roomId', authenticate, authorize('user'), validate(roomIdParam, 'params'), videoController.userVideoRoom);
router.get('/doctor/video/:roomId', authenticate, authorize('doctor'), validate(roomIdParam, 'params'), videoController.docVideoRoom);

// Dashboards
router.get('/doctor/video/dashboard', authenticate, authorize('doctor'), videoController.docDashboard);
router.get('/patient/video/dashboard', authenticate, authorize('user'), videoController.userDashboard);

// Start/Join calls
router.post('/appointments/:appointmentId/start', authenticate, authorize('doctor'), validate(appointmentIdParam, 'params'), videoController.startCall);
router.post('/doctor/start-call/:appointmentId', authenticate, authorize('doctor'), validate(appointmentIdParam, 'params'), videoController.docStartCall);
router.get('/patient/join-call/:appointmentId', authenticate, authorize('user'), validate(appointmentIdParam, 'params'), videoController.userJoinCall);

// Backward-compatible legacy aliases
router.post('/doc/start-call/:appointmentId', authenticate, authorize('doctor'), validate(appointmentIdParam, 'params'), videoController.docStartCall);
router.get('/user/join-call/:appointmentId', authenticate, authorize('user'), validate(appointmentIdParam, 'params'), videoController.userJoinCall);

// Notes
router.post('/api/notes/save', authenticate, authorize('doctor'), validate(saveNotesSchema), videoController.saveNotes);

module.exports = router;
