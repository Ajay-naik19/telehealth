const { pool } = require('../../config/database');

class PharmacyModel {

    // ── Categories ──
    static async getCategories() {
        const result = await pool.query(
            `SELECT id, name, slug, description, image_url, sort_order
             FROM pharmacy_categories
             WHERE is_active = TRUE
             ORDER BY sort_order`
        );
        return result.rows;
    }

    // ── Products ──
    static async getProducts({ categoryId, search, priceMin, priceMax, sort, page, limit }) {
        const values = [];
        const conditions = ['p.is_active = TRUE'];
        let idx = 1;

        if (categoryId) {
            conditions.push(`p.category_id = $${idx++}`);
            values.push(categoryId);
        }
        if (search) {
            conditions.push(
                `to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', $${idx++})`
            );
            values.push(search);
        }
        if (priceMin != null) {
            conditions.push(`p.price >= $${idx++}`);
            values.push(priceMin);
        }
        if (priceMax != null) {
            conditions.push(`p.price <= $${idx++}`);
            values.push(priceMax);
        }

        const where = conditions.join(' AND ');

        let orderBy;
        switch (sort) {
            case 'price_low':  orderBy = 'p.price ASC'; break;
            case 'price_high': orderBy = 'p.price DESC'; break;
            case 'rating':     orderBy = 'p.avg_rating DESC'; break;
            case 'newest':     orderBy = 'p.created_at DESC'; break;
            default:           orderBy = 'p.id ASC';
        }

        const offset = (page - 1) * limit;

        const countQuery = `
            SELECT COUNT(*) FROM pharmacy_products p WHERE ${where}
        `;
        const dataQuery = `
            SELECT p.*, i.stock_quantity, c.name AS category_name, c.slug AS category_slug
            FROM pharmacy_products p
            JOIN pharmacy_inventory i ON i.product_id = p.id
            JOIN pharmacy_categories c ON c.id = p.category_id
            WHERE ${where}
            ORDER BY ${orderBy}
            LIMIT $${idx++} OFFSET $${idx++}
        `;

        values.push(limit, offset);

        const [countRes, dataRes] = await Promise.all([
            pool.query(countQuery, values.slice(0, values.length - 2)),
            pool.query(dataQuery, values)
        ]);

        return {
            products: dataRes.rows,
            total: parseInt(countRes.rows[0].count, 10)
        };
    }

    static async getProductBySlug(slug) {
        const result = await pool.query(
            `SELECT p.*, i.stock_quantity, c.name AS category_name, c.slug AS category_slug
             FROM pharmacy_products p
             JOIN pharmacy_inventory i ON i.product_id = p.id
             JOIN pharmacy_categories c ON c.id = p.category_id
             WHERE p.slug = $1 AND p.is_active = TRUE`,
            [slug]
        );
        return result.rows[0] || null;
    }

    static async getProductById(id) {
        const result = await pool.query(
            `SELECT p.*, i.stock_quantity
             FROM pharmacy_products p
             JOIN pharmacy_inventory i ON i.product_id = p.id
             WHERE p.id = $1 AND p.is_active = TRUE`,
            [id]
        );
        return result.rows[0] || null;
    }

    // ── Cart ──
    static async getOrCreateCart(userId) {
        // Try to get existing active cart
        let result = await pool.query(
            `SELECT id FROM pharmacy_carts WHERE user_id = $1 AND status = 'active'`,
            [userId]
        );
        if (result.rows[0]) return result.rows[0].id;

        // Create new cart
        result = await pool.query(
            `INSERT INTO pharmacy_carts (user_id, status) VALUES ($1, 'active') RETURNING id`,
            [userId]
        );
        return result.rows[0].id;
    }

    static async getCartItems(userId) {
        const result = await pool.query(
            `SELECT ci.id, ci.product_id, ci.quantity,
                    p.name, p.slug, p.price, p.image_url, p.prescription_required,
                    i.stock_quantity
             FROM pharmacy_cart_items ci
             JOIN pharmacy_carts c ON c.id = ci.cart_id
             JOIN pharmacy_products p ON p.id = ci.product_id
             JOIN pharmacy_inventory inv ON inv.product_id = p.id
             JOIN pharmacy_inventory i ON i.product_id = ci.product_id
             WHERE c.user_id = $1 AND c.status = 'active'
             ORDER BY ci.created_at`,
            [userId]
        );
        return result.rows;
    }

    static async getCartItemCount(userId) {
        const result = await pool.query(
            `SELECT COALESCE(SUM(ci.quantity), 0) AS count
             FROM pharmacy_cart_items ci
             JOIN pharmacy_carts c ON c.id = ci.cart_id
             WHERE c.user_id = $1 AND c.status = 'active'`,
            [userId]
        );
        return parseInt(result.rows[0].count, 10);
    }

    static async addToCart(cartId, productId, quantity) {
        const result = await pool.query(
            `INSERT INTO pharmacy_cart_items (cart_id, product_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (cart_id, product_id)
             DO UPDATE SET quantity = pharmacy_cart_items.quantity + $3, updated_at = now()
             RETURNING *`,
            [cartId, productId, quantity]
        );
        return result.rows[0];
    }

    static async updateCartItem(cartId, productId, quantity) {
        const result = await pool.query(
            `UPDATE pharmacy_cart_items
             SET quantity = $3, updated_at = now()
             WHERE cart_id = $1 AND product_id = $2
             RETURNING *`,
            [cartId, productId, quantity]
        );
        return result.rows[0] || null;
    }

    static async removeCartItem(cartId, productId) {
        const result = await pool.query(
            `DELETE FROM pharmacy_cart_items
             WHERE cart_id = $1 AND product_id = $2
             RETURNING id`,
            [cartId, productId]
        );
        return result.rowCount > 0;
    }

    static async convertCart(cartId) {
        await pool.query(
            `UPDATE pharmacy_carts SET status = 'converted', updated_at = now() WHERE id = $1`,
            [cartId]
        );
    }

    // ── Orders ──
    static async createOrder(orderData, client) {
        const db = client || pool;
        const result = await db.query(
            `INSERT INTO pharmacy_orders
             (user_id, subtotal, discount_amount, shipping_fee, tax_amount, total_amount,
              shipping_name, shipping_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                orderData.userId, orderData.subtotal, orderData.discount || 0,
                orderData.shippingFee || 0, orderData.tax || 0, orderData.totalAmount,
                orderData.shippingName, orderData.shippingPhone, orderData.shippingAddress,
                orderData.shippingCity, orderData.shippingState, orderData.shippingPincode,
                orderData.notes || null
            ]
        );
        return result.rows[0];
    }

    static async createOrderItems(orderId, items, client) {
        const db = client || pool;
        const values = [];
        const placeholders = [];
        let idx = 1;

        for (const item of items) {
            const totalPrice = (item.quantity * parseFloat(item.price)).toFixed(2);
            placeholders.push(
                `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
            );
            values.push(orderId, item.product_id, item.name, item.image_url || null, item.quantity, item.price, totalPrice);
        }

        await db.query(
            `INSERT INTO pharmacy_order_items
             (order_id, product_id, product_name, product_image, quantity, unit_price, total_price)
             VALUES ${placeholders.join(', ')}`,
            values
        );
    }

    static async getUserOrders(userId, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        const result = await pool.query(
            `SELECT o.*,
                    (SELECT COUNT(*) FROM pharmacy_order_items WHERE order_id = o.id) AS item_count
             FROM pharmacy_orders o
             WHERE o.user_id = $1
             ORDER BY o.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows;
    }

    static async getOrderById(orderId, userId) {
        const orderRes = await pool.query(
            `SELECT * FROM pharmacy_orders WHERE id = $1 AND user_id = $2`,
            [orderId, userId]
        );
        if (!orderRes.rows[0]) return null;

        const itemsRes = await pool.query(
            `SELECT * FROM pharmacy_order_items WHERE order_id = $1 ORDER BY id`,
            [orderId]
        );

        return { ...orderRes.rows[0], items: itemsRes.rows };
    }

    // ── Reviews ──
    static async createReview({ productId, userId, orderId, rating, title, comment }) {
        const result = await pool.query(
            `INSERT INTO pharmacy_reviews (product_id, user_id, order_id, rating, title, comment, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $3 IS NOT NULL)
             ON CONFLICT (product_id, user_id)
             DO UPDATE SET rating = $4, title = $5, comment = $6, updated_at = now()
             RETURNING *`,
            [productId, userId, orderId || null, rating, title || null, comment || null]
        );
        return result.rows[0];
    }

    static async getProductReviews(productId, page = 1, limit = 10) {
        const offset = (page - 1) * limit;
        const result = await pool.query(
            `SELECT r.*, COALESCE(up.full_name, 'Anonymous') AS reviewer_name
             FROM pharmacy_reviews r
             LEFT JOIN user_profile up ON up.user_id = r.user_id
             WHERE r.product_id = $1 AND r.is_visible = TRUE
             ORDER BY r.created_at DESC
             LIMIT $2 OFFSET $3`,
            [productId, limit, offset]
        );
        return result.rows;
    }

    static async getUserReviewForProduct(userId, productId) {
        const result = await pool.query(
            `SELECT * FROM pharmacy_reviews WHERE user_id = $1 AND product_id = $2`,
            [userId, productId]
        );
        return result.rows[0] || null;
    }

    static async hasUserPurchasedProduct(userId, productId) {
        const result = await pool.query(
            `SELECT 1 FROM pharmacy_orders o
             JOIN pharmacy_order_items oi ON oi.order_id = o.id
             WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status IN ('delivered', 'confirmed', 'processing', 'shipped')
             LIMIT 1`,
            [userId, productId]
        );
        return result.rows.length > 0;
    }

    // ── Wishlist ──
    static async isInWishlist(userId, productId) {
        const result = await pool.query(
            `SELECT 1 FROM pharmacy_wishlist WHERE user_id = $1 AND product_id = $2`,
            [userId, productId]
        );
        return result.rows.length > 0;
    }

    static async addToWishlist(userId, productId) {
        await pool.query(
            `INSERT INTO pharmacy_wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, productId]
        );
    }

    static async removeFromWishlist(userId, productId) {
        await pool.query(
            `DELETE FROM pharmacy_wishlist WHERE user_id = $1 AND product_id = $2`,
            [userId, productId]
        );
    }

    static async getWishlist(userId) {
        const result = await pool.query(
            `SELECT w.id, w.created_at AS added_at,
                    p.id AS product_id, p.name, p.slug, p.price, p.compare_at_price,
                    p.image_url, p.avg_rating, p.review_count, p.prescription_required,
                    i.stock_quantity, c.name AS category_name
             FROM pharmacy_wishlist w
             JOIN pharmacy_products p ON p.id = w.product_id
             JOIN pharmacy_inventory i ON i.product_id = p.id
             JOIN pharmacy_categories c ON c.id = p.category_id
             WHERE w.user_id = $1 AND p.is_active = TRUE
             ORDER BY w.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
}

module.exports = PharmacyModel;
