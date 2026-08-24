const { z } = require('zod');

const addToCartSchema = z.object({
    productId: z.coerce.number({ required_error: 'Product ID is required' })
        .int().positive(),
    quantity: z.coerce.number().int().min(1).max(50).default(1)
});

const updateCartSchema = z.object({
    productId: z.coerce.number({ required_error: 'Product ID is required' })
        .int().positive(),
    quantity: z.coerce.number({ required_error: 'Quantity is required' })
        .int().min(1, 'Minimum quantity is 1').max(50, 'Maximum quantity is 50')
});

const placeOrderSchema = z.object({
    name: z.string({ required_error: 'Full name is required' })
        .min(2, 'Name must be at least 2 characters')
        .max(200),
    phone: z.string({ required_error: 'Phone number is required' })
        .min(10, 'Enter a valid phone number')
        .max(15),
    address: z.string({ required_error: 'Address is required' })
        .min(5, 'Enter a complete address')
        .max(500),
    city: z.string({ required_error: 'City is required' })
        .min(2).max(100),
    state: z.string({ required_error: 'State is required' })
        .min(2).max(100),
    pincode: z.string({ required_error: 'Pincode is required' })
        .min(4).max(10),
    notes: z.string().max(500).optional().default('')
});

const submitReviewSchema = z.object({
    productId: z.coerce.number({ required_error: 'Product ID is required' })
        .int().positive(),
    rating: z.coerce.number({ required_error: 'Rating is required' })
        .int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
    title: z.string().max(200).optional().default(''),
    comment: z.string().max(1000).optional().default('')
});

const toggleWishlistSchema = z.object({
    productId: z.coerce.number({ required_error: 'Product ID is required' })
        .int().positive()
});

const productIdParam = z.object({
    productId: z.coerce.number().int().positive()
});

const productSlugParam = z.object({
    slug: z.string().min(1)
});

const orderIdParam = z.object({
    id: z.coerce.number().int().positive()
});

module.exports = {
    addToCartSchema,
    updateCartSchema,
    placeOrderSchema,
    submitReviewSchema,
    toggleWishlistSchema,
    productIdParam,
    productSlugParam,
    orderIdParam
};
