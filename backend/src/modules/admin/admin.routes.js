const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const {
    adminLoginSchema,
    listFiltersSchema,
    overrideStatusSchema,
    doctorIdParam,
    appointmentIdParam,
    createProductSchema,
    updateProductSchema,
    updateStockSchema,
    createCategorySchema,
    updateCategorySchema,
    updateOrderStatusSchema,
    pharmacyProductFiltersSchema,
    pharmacyOrderFiltersSchema,
    productIdParam,
    categoryIdParam,
    orderIdParam
} = require('./admin.schema');

router.post('/api/admin/login', validate(adminLoginSchema), adminController.login);

// Protected admin routes
router.get('/api/admin/stats', authenticate, authorize('admin'), adminController.getDashboardStats);
router.get('/api/admin/doctors', authenticate, authorize('admin'), adminController.listDoctors);
router.get('/api/admin/patients', authenticate, authorize('admin'), adminController.listPatients);
router.get('/api/admin/appointments', authenticate, authorize('admin'), validate(listFiltersSchema, 'query'), adminController.listAppointments);
router.post('/api/admin/appointments/:id/override', authenticate, authorize('admin'), validate(appointmentIdParam, 'params'), validate(overrideStatusSchema), adminController.overrideAppointment);
router.get('/api/admin/doctors/:id/schedule', authenticate, authorize('admin'), validate(doctorIdParam, 'params'), adminController.viewDoctorSchedule);

// ════════════════════════════════════════════
// PHARMACY – Products
// ════════════════════════════════════════════
router.get('/api/admin/pharmacy/products', authenticate, authorize('admin'), validate(pharmacyProductFiltersSchema, 'query'), adminController.listProducts);
router.post('/api/admin/pharmacy/products', authenticate, authorize('admin'), validate(createProductSchema), adminController.createProduct);
router.put('/api/admin/pharmacy/products/:id', authenticate, authorize('admin'), validate(productIdParam, 'params'), validate(updateProductSchema), adminController.updateProduct);
router.delete('/api/admin/pharmacy/products/:id', authenticate, authorize('admin'), validate(productIdParam, 'params'), adminController.deleteProduct);
router.put('/api/admin/pharmacy/products/:id/stock', authenticate, authorize('admin'), validate(productIdParam, 'params'), validate(updateStockSchema), adminController.updateStock);
router.get('/api/admin/pharmacy/low-stock', authenticate, authorize('admin'), adminController.getLowStockProducts);

// ════════════════════════════════════════════
// PHARMACY – Categories
// ════════════════════════════════════════════
router.get('/api/admin/pharmacy/categories', authenticate, authorize('admin'), adminController.listCategories);
router.post('/api/admin/pharmacy/categories', authenticate, authorize('admin'), validate(createCategorySchema), adminController.createCategory);
router.put('/api/admin/pharmacy/categories/:id', authenticate, authorize('admin'), validate(categoryIdParam, 'params'), validate(updateCategorySchema), adminController.updateCategory);
router.delete('/api/admin/pharmacy/categories/:id', authenticate, authorize('admin'), validate(categoryIdParam, 'params'), adminController.deleteCategory);

// ════════════════════════════════════════════
// PHARMACY – Orders
// ════════════════════════════════════════════
router.get('/api/admin/pharmacy/orders', authenticate, authorize('admin'), validate(pharmacyOrderFiltersSchema, 'query'), adminController.listOrders);
router.put('/api/admin/pharmacy/orders/:id/status', authenticate, authorize('admin'), validate(orderIdParam, 'params'), validate(updateOrderStatusSchema), adminController.updateOrderStatus);

module.exports = router;
