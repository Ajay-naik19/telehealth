const catchAsync = require('../../utils/catchAsync');
const adminService = require('./admin.service');
const { accessTokenCookieOptions, refreshTokenCookieOptions } = require('../../config');
const sendResponse = require('../../utils/sendResponse');

const login = catchAsync(async (req, res) => {
    const { phone, password } = req.validated.body;
    const result = await adminService.login(phone, password);

    res.cookie('accessToken', result.accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', result.refreshToken, refreshTokenCookieOptions);

    return sendResponse(res, 200, 'Admin login successful', {
        admin: result.admin,
        accessToken: result.accessToken
    });
});


const getDashboardStats = catchAsync(async (req, res) => {
    const stats = await adminService.getDashboardStats();
    return sendResponse(res, 200, 'Dashboard stats fetched successfully', stats);
});

const listDoctors = catchAsync(async (req, res) => {
    const page = req.validated?.query?.page || 1;
    const doctors = await adminService.listDoctors(page);
    return sendResponse(res, 200, 'Doctors fetched successfully', doctors);
});

const listPatients = catchAsync(async (req, res) => {
    const page = req.validated?.query?.page || 1;
    const patients = await adminService.listPatients(page);
    return sendResponse(res, 200, 'Patients fetched successfully', patients);
});

const listAppointments = catchAsync(async (req, res) => {
    const { page, status, doctorId, date } = req.validated?.query || {};
    const filters = {};
    if (status) filters.status = status;
    if (doctorId) filters.doctorId = doctorId;
    if (date) filters.date = date;

    const appointments = await adminService.listAppointments(filters, page || 1);
    return sendResponse(res, 200, 'Appointments fetched successfully', appointments);
});

const overrideAppointment = catchAsync(async (req, res) => {
    const appointmentId = Number(req.params.id);
    const { status } = req.validated.body;
    const appointment = await adminService.overrideAppointment(appointmentId, status);
    return sendResponse(res, 200, 'Appointment status updated successfully', appointment);
});

const viewDoctorSchedule = catchAsync(async (req, res) => {
    const doctorId = Number(req.params.id);
    const schedule = await adminService.viewDoctorSchedule(doctorId);
    return sendResponse(res, 200, 'Doctor schedule fetched successfully', schedule);
});

// ════════════════════════════════════════════
// PHARMACY – Products
// ════════════════════════════════════════════

const listProducts = catchAsync(async (req, res) => {
    const { page, search, categoryId } = req.validated?.query || {};
    const filters = {};
    if (search) filters.search = search;
    if (categoryId) filters.categoryId = categoryId;
    const data = await adminService.listProducts(filters, page || 1);
    return sendResponse(res, 200, 'Products fetched successfully', data);
});

const createProduct = catchAsync(async (req, res) => {
    const product = await adminService.createProduct(req.validated.body);
    return sendResponse(res, 201, 'Product created successfully', product);
});

const updateProduct = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    const product = await adminService.updateProduct(id, req.validated.body);
    return sendResponse(res, 200, 'Product updated successfully', product);
});

const deleteProduct = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    await adminService.deleteProduct(id);
    return sendResponse(res, 200, 'Product deactivated', null);
});

const updateStock = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    const { stockQuantity, lowStockThreshold } = req.validated.body;
    const inventory = await adminService.updateStock(id, stockQuantity, lowStockThreshold);
    return sendResponse(res, 200, 'Stock updated successfully', inventory);
});

const getLowStockProducts = catchAsync(async (req, res) => {
    const data = await adminService.getLowStockProducts();
    return sendResponse(res, 200, 'Low stock products fetched successfully', data);
});

// ════════════════════════════════════════════
// PHARMACY – Categories
// ════════════════════════════════════════════

const listCategories = catchAsync(async (req, res) => {
    const data = await adminService.listCategories();
    return sendResponse(res, 200, 'Categories fetched successfully', data);
});

const createCategory = catchAsync(async (req, res) => {
    const category = await adminService.createCategory(req.validated.body);
    return sendResponse(res, 201, 'Category created successfully', category);
});

const updateCategory = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    const category = await adminService.updateCategory(id, req.validated.body);
    return sendResponse(res, 200, 'Category updated successfully', category);
});

const deleteCategory = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    await adminService.deleteCategory(id);
    return sendResponse(res, 200, 'Category deactivated', null);
});

// ════════════════════════════════════════════
// PHARMACY – Orders
// ════════════════════════════════════════════

const listOrders = catchAsync(async (req, res) => {
    const { page, status } = req.validated?.query || {};
    const filters = {};
    if (status) filters.status = status;
    const data = await adminService.listOrders(filters, page || 1);
    return sendResponse(res, 200, 'Orders fetched successfully', data);
});

const updateOrderStatus = catchAsync(async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.validated.body;
    const order = await adminService.updateOrderStatus(id, status);
    return sendResponse(res, 200, 'Order status updated successfully', order);
});

module.exports = {
    login,
    getDashboardStats,
    listDoctors,
    listPatients,
    listAppointments,
    overrideAppointment,
    viewDoctorSchedule,
    listProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    getLowStockProducts,
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    listOrders,
    updateOrderStatus
};
