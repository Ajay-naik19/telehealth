const PharmacyModel = require('./pharmacy.model');
const { pool } = require('../../config/database');
const { AppError } = require('../../utils/AppError');

class PharmacyService {

    async getCategories() {
        return PharmacyModel.getCategories();
    }

    async listProducts(filters) {
        const page = Math.max(1, parseInt(filters.page) || 1);
        const limit = Math.min(40, Math.max(1, parseInt(filters.limit) || 12));

        const { products, total } = await PharmacyModel.getProducts({
            categoryId: filters.category_id || null,
            search: filters.search || null,
            priceMin: filters.price_min != null ? parseFloat(filters.price_min) : null,
            priceMax: filters.price_max != null ? parseFloat(filters.price_max) : null,
            sort: filters.sort || 'default',
            page,
            limit
        });

        return {
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getProduct(slug, userId) {
        const product = await PharmacyModel.getProductBySlug(slug);
        if (!product) throw new AppError('Product not found', 404);

        const reviews = await PharmacyModel.getProductReviews(product.id, 1, 10);

        let inWishlist = false;
        let userReview = null;
        let hasPurchased = false;
        if (userId) {
            [inWishlist, userReview, hasPurchased] = await Promise.all([
                PharmacyModel.isInWishlist(userId, product.id),
                PharmacyModel.getUserReviewForProduct(userId, product.id),
                PharmacyModel.hasUserPurchasedProduct(userId, product.id)
            ]);
        }

        return { product, reviews, inWishlist, userReview, hasPurchased };
    }

    // ── Cart ──
    async addToCart(userId, productId, quantity) {
        const product = await PharmacyModel.getProductById(productId);
        if (!product) throw new AppError('Product not found', 404);

        if (product.stock_quantity < quantity) {
            throw new AppError(
                product.stock_quantity === 0
                    ? 'This product is out of stock'
                    : `Only ${product.stock_quantity} units available`,
                400
            );
        }

        const cartId = await PharmacyModel.getOrCreateCart(userId);
        const item = await PharmacyModel.addToCart(cartId, productId, quantity);
        const cartCount = await PharmacyModel.getCartItemCount(userId);
        return { item, cartCount };
    }

    async updateCartItem(userId, productId, quantity) {
        const product = await PharmacyModel.getProductById(productId);
        if (!product) throw new AppError('Product not found', 404);

        if (product.stock_quantity < quantity) {
            throw new AppError(
                product.stock_quantity === 0
                    ? 'This product is out of stock'
                    : `Only ${product.stock_quantity} units available`,
                400
            );
        }

        const cartId = await PharmacyModel.getOrCreateCart(userId);
        const item = await PharmacyModel.updateCartItem(cartId, productId, quantity);
        if (!item) throw new AppError('Item not in cart', 404);

        const cartCount = await PharmacyModel.getCartItemCount(userId);
        return { item, cartCount };
    }

    async removeFromCart(userId, productId) {
        const cartId = await PharmacyModel.getOrCreateCart(userId);
        const removed = await PharmacyModel.removeCartItem(cartId, productId);
        if (!removed) throw new AppError('Item not in cart', 404);

        const cartCount = await PharmacyModel.getCartItemCount(userId);
        return { cartCount };
    }

    async getCart(userId) {
        const items = await PharmacyModel.getCartItems(userId);
        let subtotal = 0;
        for (const item of items) {
            item.line_total = parseFloat(item.price) * item.quantity;
            subtotal += item.line_total;
        }
        return { items, subtotal: parseFloat(subtotal.toFixed(2)), itemCount: items.length };
    }

    // ── Orders ──
    async placeOrder(userId, shippingInfo) {
        const cart = await this.getCart(userId);
        if (cart.items.length === 0) throw new AppError('Cart is empty', 400);

        // Check stock for all items
        for (const item of cart.items) {
            if (item.stock_quantity < item.quantity) {
                throw new AppError(
                    `${item.name} has only ${item.stock_quantity} units available. Please update your cart.`,
                    400
                );
            }
        }

        // Check prescription requirements
        const needsPrescription = cart.items.some(i => i.prescription_required);
        if (needsPrescription) {
            throw new AppError('Some items require a prescription. Please consult a doctor first.', 400);
        }

        const shippingFee = cart.subtotal >= 500 ? 0 : 49;
        const totalAmount = parseFloat((cart.subtotal + shippingFee).toFixed(2));

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const order = await PharmacyModel.createOrder({
                userId,
                subtotal: cart.subtotal,
                discount: 0,
                shippingFee,
                tax: 0,
                totalAmount,
                shippingName: shippingInfo.name,
                shippingPhone: shippingInfo.phone,
                shippingAddress: shippingInfo.address,
                shippingCity: shippingInfo.city,
                shippingState: shippingInfo.state,
                shippingPincode: shippingInfo.pincode,
                notes: shippingInfo.notes
            }, client);

            const orderItems = cart.items.map(item => ({
                product_id: item.product_id,
                name: item.name,
                image_url: item.image_url,
                quantity: item.quantity,
                price: item.price
            }));

            await PharmacyModel.createOrderItems(order.id, orderItems, client);

            // Convert cart
            const cartId = await PharmacyModel.getOrCreateCart(userId);
            await client.query(
                `UPDATE pharmacy_carts SET status = 'converted', updated_at = now() WHERE id = $1`,
                [cartId]
            );

            await client.query('COMMIT');
            return order;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async getOrders(userId, page) {
        return PharmacyModel.getUserOrders(userId, page, 10);
    }

    async getOrderDetail(orderId, userId) {
        const order = await PharmacyModel.getOrderById(orderId, userId);
        if (!order) throw new AppError('Order not found', 404);
        return order;
    }

    // ── Reviews ──
    async submitReview(userId, productId, rating, title, comment) {
        const product = await PharmacyModel.getProductById(productId);
        if (!product) throw new AppError('Product not found', 404);

        // Check if user has ordered this product
        const hasPurchased = await PharmacyModel.hasUserPurchasedProduct(userId, productId);

        // Find order ID for verified review
        let orderId = null;
        if (hasPurchased) {
            const orderRes = await pool.query(
                `SELECT o.id FROM pharmacy_orders o
                 JOIN pharmacy_order_items oi ON oi.order_id = o.id
                 WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status IN ('delivered','confirmed','processing','shipped')
                 ORDER BY o.created_at DESC LIMIT 1`,
                [userId, productId]
            );
            orderId = orderRes.rows[0]?.id || null;
        }

        return PharmacyModel.createReview({
            productId, userId, orderId, rating, title, comment
        });
    }

    // ── Wishlist ──
    async toggleWishlist(userId, productId) {
        const product = await PharmacyModel.getProductById(productId);
        if (!product) throw new AppError('Product not found', 404);

        const isInWishlist = await PharmacyModel.isInWishlist(userId, productId);

        if (isInWishlist) {
            await PharmacyModel.removeFromWishlist(userId, productId);
            return { added: false };
        } else {
            await PharmacyModel.addToWishlist(userId, productId);
            return { added: true };
        }
    }

    async getWishlist(userId) {
        return PharmacyModel.getWishlist(userId);
    }
}

module.exports = new PharmacyService();
