const { pool } = require('../../config/database');

class AdminModel {
    /**
     * Find an admin by phone number.
     */
    static async findByPhone(phone) {
        const result = await pool.query(
            `SELECT id, phone, password, created_at
             FROM users
             WHERE phone = $1 AND role = 'admin'`,
            [phone]
        );
        return result.rows[0] || null;
    }

    /**
     * Create a new admin account.
     */
    static async createAdmin(phone, hashedPassword) {
        const result = await pool.query(
            `INSERT INTO users (phone, password, role)
             VALUES ($1, $2, 'admin')
             RETURNING id, phone`,
            [phone, hashedPassword]
        );
        return result.rows[0];
    }

    /**
     * Get all doctors with profile info, paginated.
     */
    static async getAllDoctors(limit = 20, offset = 0) {
        const result = await pool.query(
            `SELECT u.id, u.phone, u.created_at,
                    dp.full_name, dp.specialization, dp.experience_years,
                    dp.qualification, dp.hospital_name
             FROM users u
             LEFT JOIN doc_profile dp ON u.id = dp.doc_id
             WHERE u.role = 'doctor'
             ORDER BY u.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    }

    /**
     * Get all patients with profile info, paginated.
     */
    static async getAllPatients(limit = 20, offset = 0) {
        const result = await pool.query(
            `SELECT u.id, u.phone, u.created_at,
                    up.full_name, up.gender, up.date_of_birth,
                    up.blood_group
             FROM users u
             LEFT JOIN user_profile up ON u.id = up.user_id
             WHERE u.role = 'user'
             ORDER BY u.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    }

    /**
     * Get all appointments with optional filters, paginated.
     * Filters: status, doctorId, date
     */
    static async getAllAppointments(filters = {}, limit = 20, offset = 0) {
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        if (filters.status) {
            conditions.push(`a.status = $${paramIndex++}`);
            params.push(filters.status);
        }
        if (filters.doctorId) {
            conditions.push(`a.doctor_id = $${paramIndex++}`);
            params.push(filters.doctorId);
        }
        if (filters.date) {
            conditions.push(`a.appointment_date = $${paramIndex++}`);
            params.push(filters.date);
        }

        const whereClause = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        params.push(limit);
        params.push(offset);

        const result = await pool.query(
            `SELECT a.*,
                    up.full_name AS patient_name,
                    dp.full_name AS doctor_name
             FROM appointments a
             LEFT JOIN user_profile up ON a.user_id = up.user_id
             LEFT JOIN doc_profile dp ON a.doctor_id = dp.doc_id
             ${whereClause}
             ORDER BY a.appointment_date DESC, a.appointment_time DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
            params
        );
        return result.rows;
    }

    /**
     * Get system-wide statistics (includes pharmacy).
     */
    static async getSystemStats() {
        const [patients, doctors, appointments, active, completedToday,
               totalOrders, revenue, lowStock] = await Promise.all([
            pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'user'"),
            pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'doctor'"),
            pool.query('SELECT COUNT(*) AS count FROM appointments'),
            pool.query(
                `SELECT COUNT(*) AS count FROM appointments
                 WHERE status IN ('scheduled', 'started')`
            ),
            pool.query(
                `SELECT COUNT(*) AS count FROM appointments
                 WHERE status = 'completed'
                   AND appointment_date = CURRENT_DATE`
            ),
            pool.query('SELECT COUNT(*) AS count FROM pharmacy_orders'),
            pool.query(
                `SELECT COALESCE(SUM(total_amount), 0) AS total
                 FROM pharmacy_orders
                 WHERE status IN ('confirmed','processing','shipped','delivered')`
            ),
            pool.query(
                `SELECT COUNT(*) AS count
                 FROM pharmacy_inventory i
                 JOIN pharmacy_products p ON p.id = i.product_id
                 WHERE p.is_active = TRUE AND i.stock_quantity <= i.low_stock_threshold`
            )
        ]);

        return {
            totalPatients: parseInt(patients.rows[0].count, 10),
            totalDoctors: parseInt(doctors.rows[0].count, 10),
            totalAppointments: parseInt(appointments.rows[0].count, 10),
            activeAppointments: parseInt(active.rows[0].count, 10),
            completedToday: parseInt(completedToday.rows[0].count, 10),
            totalOrders: parseInt(totalOrders.rows[0].count, 10),
            totalRevenue: parseFloat(revenue.rows[0].total),
            lowStockCount: parseInt(lowStock.rows[0].count, 10)
        };
    }

    /**
     * Override an appointment's status (admin action).
     */
    static async overrideAppointmentStatus(appointmentId, newStatus) {
        const result = await pool.query(
            `UPDATE appointments
             SET status = $2, updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [appointmentId, newStatus]
        );
        return result.rows[0] || null;
    }

    /**
     * Get a doctor's active schedule entries.
     */
    static async getDoctorSchedule(doctorId) {
        const result = await pool.query(
            `SELECT id, day_of_week, start_time, end_time, is_active, created_at
             FROM doctor_schedules
             WHERE doctor_id = $1 AND is_active = TRUE
             ORDER BY day_of_week, start_time`,
            [doctorId]
        );
        return result.rows;
    }

    // ════════════════════════════════════════════
    // PHARMACY – Products
    // ════════════════════════════════════════════

    static async getAllProducts(filters = {}, limit = 20, offset = 0) {
        const conditions = [];
        const params = [];
        let idx = 1;

        if (filters.search) {
            conditions.push(`p.name ILIKE $${idx++}`);
            params.push(`%${filters.search}%`);
        }
        if (filters.categoryId) {
            conditions.push(`p.category_id = $${idx++}`);
            params.push(filters.categoryId);
        }

        const where = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        params.push(limit, offset);

        const [countRes, dataRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) FROM pharmacy_products p ${where}`,
                params.slice(0, params.length - 2)
            ),
            pool.query(
                `SELECT p.*, i.stock_quantity, i.low_stock_threshold, i.last_restocked,
                        c.name AS category_name
                 FROM pharmacy_products p
                 LEFT JOIN pharmacy_inventory i ON i.product_id = p.id
                 LEFT JOIN pharmacy_categories c ON c.id = p.category_id
                 ${where}
                 ORDER BY p.created_at DESC
                 LIMIT $${idx++} OFFSET $${idx}`,
                params
            )
        ]);

        return {
            products: dataRes.rows,
            total: parseInt(countRes.rows[0].count, 10)
        };
    }

    static async getProductById(id) {
        const result = await pool.query(
            `SELECT p.*, i.stock_quantity, i.low_stock_threshold,
                    c.name AS category_name
             FROM pharmacy_products p
             LEFT JOIN pharmacy_inventory i ON i.product_id = p.id
             LEFT JOIN pharmacy_categories c ON c.id = p.category_id
             WHERE p.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    static async createProduct(data) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const slug = data.name.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                + '-' + Date.now();

            const prodRes = await client.query(
                `INSERT INTO pharmacy_products
                 (category_id, name, slug, description, short_description, price, compare_at_price,
                  sku, image_url, manufacturer, dosage_form, strength, pack_size, prescription_required)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                 RETURNING *`,
                [
                    data.categoryId, data.name, slug,
                    data.description || null, data.shortDescription || null,
                    data.price, data.compareAtPrice || null,
                    data.sku, data.imageUrl || null,
                    data.manufacturer || null, data.dosageForm || null,
                    data.strength || null, data.packSize || null,
                    data.prescriptionRequired || false
                ]
            );

            await client.query(
                `INSERT INTO pharmacy_inventory (product_id, stock_quantity, low_stock_threshold)
                 VALUES ($1, $2, $3)`,
                [prodRes.rows[0].id, data.stockQuantity || 0, data.lowStockThreshold || 10]
            );

            await client.query('COMMIT');
            return prodRes.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    static async updateProduct(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;

        const map = {
            name: 'name', categoryId: 'category_id', price: 'price',
            compareAtPrice: 'compare_at_price', sku: 'sku',
            description: 'description', shortDescription: 'short_description',
            imageUrl: 'image_url', manufacturer: 'manufacturer',
            dosageForm: 'dosage_form', strength: 'strength',
            packSize: 'pack_size', prescriptionRequired: 'prescription_required'
        };

        for (const [jsKey, dbCol] of Object.entries(map)) {
            if (data[jsKey] !== undefined) {
                fields.push(`${dbCol} = $${idx++}`);
                params.push(data[jsKey] === '' ? null : data[jsKey]);
            }
        }

        if (data.name && !data.slug) {
            fields.push(`slug = $${idx++}`);
            params.push(
                data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                + '-' + Date.now()
            );
        }

        if (fields.length === 0) return await this.getProductById(id);

        params.push(id);
        const result = await pool.query(
            `UPDATE pharmacy_products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        return result.rows[0] || null;
    }

    static async deleteProduct(id) {
        const result = await pool.query(
            `UPDATE pharmacy_products SET is_active = FALSE WHERE id = $1 RETURNING id`,
            [id]
        );
        return result.rows[0] || null;
    }

    static async updateStock(productId, stockQuantity, lowStockThreshold) {
        const fields = ['stock_quantity = $2'];
        const params = [productId, stockQuantity];
        let idx = 3;

        if (lowStockThreshold !== undefined) {
            fields.push(`low_stock_threshold = $${idx++}`);
            params.push(lowStockThreshold);
        }

        fields.push('last_restocked = NOW()');

        const result = await pool.query(
            `UPDATE pharmacy_inventory SET ${fields.join(', ')} WHERE product_id = $1 RETURNING *`,
            params
        );
        return result.rows[0] || null;
    }

    static async getLowStockProducts() {
        const result = await pool.query(
            `SELECT p.id, p.name, p.sku, p.image_url, p.is_active,
                    i.stock_quantity, i.low_stock_threshold, i.last_restocked,
                    c.name AS category_name
             FROM pharmacy_products p
             JOIN pharmacy_inventory i ON i.product_id = p.id
             LEFT JOIN pharmacy_categories c ON c.id = p.category_id
             WHERE p.is_active = TRUE AND i.stock_quantity <= i.low_stock_threshold
             ORDER BY i.stock_quantity ASC`
        );
        return result.rows;
    }

    // ════════════════════════════════════════════
    // PHARMACY – Categories
    // ════════════════════════════════════════════

    static async getAllCategoriesAdmin() {
        const result = await pool.query(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM pharmacy_products p WHERE p.category_id = c.id AND p.is_active = TRUE) AS product_count
             FROM pharmacy_categories c
             ORDER BY c.sort_order, c.name`
        );
        return result.rows;
    }

    static async createCategory(data) {
        const slug = data.name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const result = await pool.query(
            `INSERT INTO pharmacy_categories (name, slug, description, image_url, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [data.name, slug, data.description || null, data.imageUrl || null, data.sortOrder || 0]
        );
        return result.rows[0];
    }

    static async updateCategory(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;

        if (data.name !== undefined) {
            fields.push(`name = $${idx++}`);
            params.push(data.name);
            fields.push(`slug = $${idx++}`);
            params.push(data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
        }
        if (data.description !== undefined) {
            fields.push(`description = $${idx++}`);
            params.push(data.description || null);
        }
        if (data.imageUrl !== undefined) {
            fields.push(`image_url = $${idx++}`);
            params.push(data.imageUrl || null);
        }
        if (data.sortOrder !== undefined) {
            fields.push(`sort_order = $${idx++}`);
            params.push(data.sortOrder);
        }

        if (fields.length === 0) return null;

        params.push(id);
        const result = await pool.query(
            `UPDATE pharmacy_categories SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        return result.rows[0] || null;
    }

    static async deleteCategory(id) {
        const result = await pool.query(
            `UPDATE pharmacy_categories SET is_active = FALSE WHERE id = $1 RETURNING id`,
            [id]
        );
        return result.rows[0] || null;
    }

    // ════════════════════════════════════════════
    // PHARMACY – Orders
    // ════════════════════════════════════════════

    static async getAllOrders(filters = {}, limit = 20, offset = 0) {
        const conditions = [];
        const params = [];
        let idx = 1;

        if (filters.status) {
            conditions.push(`o.status = $${idx++}`);
            params.push(filters.status);
        }

        const where = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        params.push(limit, offset);

        const [countRes, dataRes] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) FROM pharmacy_orders o ${where}`,
                params.slice(0, params.length - 2)
            ),
            pool.query(
                `SELECT o.*,
                        up.full_name AS customer_name,
                        (SELECT COUNT(*) FROM pharmacy_order_items WHERE order_id = o.id) AS item_count
                 FROM pharmacy_orders o
                 LEFT JOIN user_profile up ON up.user_id = o.user_id
                 ${where}
                 ORDER BY o.created_at DESC
                 LIMIT $${idx++} OFFSET $${idx}`,
                params
            )
        ]);

        return {
            orders: dataRes.rows,
            total: parseInt(countRes.rows[0].count, 10)
        };
    }

    static async updateOrderStatus(id, status) {
        const extra = status === 'delivered' ? ', delivered_at = NOW()' : '';
        const result = await pool.query(
            `UPDATE pharmacy_orders SET status = $2${extra} WHERE id = $1 RETURNING *`,
            [id, status]
        );
        return result.rows[0] || null;
    }
}

module.exports = AdminModel;
