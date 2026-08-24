const catchAsync = require('../../utils/catchAsync');
const scheduleService = require('./schedule.service');
const sendResponse = require('../../utils/sendResponse');

const getDoctorSchedule = catchAsync(async (req, res) => {
    const doctorId = req.user.id;
    const schedule = await scheduleService.getDoctorSchedule(doctorId);
    return sendResponse(res, 200, 'Doctor schedule fetched successfully', schedule);
});

const updateDoctorSchedule = catchAsync(async (req, res) => {
    const doctorId = req.user.id;
    const { schedules } = req.validated.body;
    const updated = await scheduleService.updateDoctorSchedule(doctorId, schedules);
    return sendResponse(res, 200, 'Doctor schedule updated successfully', updated);
});

const addOverride = catchAsync(async (req, res) => {
    const doctorId = req.user.id;
    const override = await scheduleService.addOverride(doctorId, req.validated.body);
    return sendResponse(res, 201, 'Override created successfully', override);
});

const removeOverride = catchAsync(async (req, res) => {
    const doctorId = req.user.id;
    const { id } = req.params;
    await scheduleService.removeOverride(Number(id), doctorId);
    return sendResponse(res, 200, 'Override removed', null);
});

const getAvailableSlots = catchAsync(async (req, res) => {
    const { doctorId, date } = req.validated.query;
    const slots = await scheduleService.getAvailableSlots(doctorId, date);
    return sendResponse(res, 200, 'Available slots fetched successfully', slots);
});

const getAvailableDoctors = catchAsync(async (req, res) => {
    const doctors = await scheduleService.getAvailableDoctors();
    return sendResponse(res, 200, 'Available doctors fetched successfully', doctors);
});

const lockSlot = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const { doctorId, date, time } = req.validated.body;
    const lockToken = await scheduleService.lockSlot(doctorId, date, time, userId);
    return sendResponse(res, 200, 'Slot locked successfully', { lockToken });
});

const unlockSlot = catchAsync(async (req, res) => {
    const { doctorId, date, time, lockToken } = req.validated.body;
    await scheduleService.unlockSlot(doctorId, date, time, lockToken);
    return sendResponse(res, 200, 'Slot unlocked', null);
});

module.exports = {
    getDoctorSchedule,
    updateDoctorSchedule,
    addOverride,
    removeOverride,
    getAvailableSlots,
    getAvailableDoctors,
    lockSlot,
    unlockSlot
};
