const { z } = require('zod');

const adminLoginSchema = z.object({
    phone: z.string().min(1, 'Phone is required'),
    password: z.string().min(6, 'Password must be at least 6 characters')
});

const listFiltersSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    status: z.string().optional(),
    doctorId: z.coerce.number().int().positive().optional(),
    date: z.string().optional()
});

const overrideStatusSchema = z.object({
    status: z.enum(['scheduled', 'started', 'completed', 'cancelled'])
});

const doctorIdParam = z.object({
    id: z.coerce.number().int().positive()
});

const appointmentIdParam = z.object({
    id: z.coerce.number().int().positive()
});

// ── Pharmacy: Product ──
const createProductSchema = z.object({
    name: z.string().min(1).max(255),
    categoryId: z.coerce.number().int().positive(),
    price: z.coerce.number().positive(),
    compareAtPrice: z.coerce.number().positive().nullable().optional(),
    sku: z.string().min(1).max(50),
    description: z.string().optional(),
    shortDescription: z.string().max(500).optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    manufacturer: z.string().max(200).optional(),
    dosageForm: z.string().max(100).optional(),
    strength: z.string().max(100).optional(),
    packSize: z.string().max(100).optional(),
    prescriptionRequired: z.boolean().default(false),
    stockQuantity: z.coerce.number().int().min(0).default(0),
    lowStockThreshold: z.coerce.number().int().min(0).default(10)
});

const updateProductSchema = createProductSchema.partial();

const updateStockSchema = z.object({
    stockQuantity: z.coerce.number().int().min(0),
    lowStockThreshold: z.coerce.number().int().min(0).optional()
});

// ── Pharmacy: Category ──
const createCategorySchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    imageUrl: z.string().url().optional().or(z.literal('')),
    sortOrder: z.coerce.number().int().min(0).default(0)
});

const updateCategorySchema = createCategorySchema.partial();

// ── Pharmacy: Order ──
const updateOrderStatusSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
});

// ── Pharmacy: Filters ──
const pharmacyProductFiltersSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    search: z.string().optional(),
    categoryId: z.coerce.number().int().positive().optional()
});

const pharmacyOrderFiltersSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    status: z.string().optional()
});

const productIdParam = z.object({
    id: z.coerce.number().int().positive()
});

const categoryIdParam = z.object({
    id: z.coerce.number().int().positive()
});

const orderIdParam = z.object({
    id: z.coerce.number().int().positive()
});

module.exports = {
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
};
