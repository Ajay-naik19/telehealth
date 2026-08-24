const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
const publicBaseUrl = process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 10000}`;

function diskPath(relativePath) {
    return path.join(uploadsRoot, ...relativePath.split('/'));
}

function relativePathFromUrl(filePath) {
    const url = new URL(filePath);
    const prefix = '/uploads/';
    if (!url.pathname.startsWith(prefix)) throw new Error('Invalid local file path');
    return decodeURIComponent(url.pathname.slice(prefix.length));
}

class FileService {
    async uploadFile(userId, file, recordType = 'general') {
        const client = await pool.connect();
        let filePath = null;

        try {
            const safeFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileName = `${Date.now()}-${safeFileName}`;
            filePath = `user_${userId}/${fileName}`;

            const destination = diskPath(filePath);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.copyFileSync(file.path, destination);
            const publicUrl = `${publicBaseUrl}/uploads/${filePath}`;

            await client.query('BEGIN');

            const dbResult = await client.query(
                `INSERT INTO medical_records
                 (user_id, file_name, file_path, record_type, uploaded_at)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [
                    userId,
                    file.originalname,
                    publicUrl,
                    recordType,
                    new Date().toISOString()
                ]
            );

            await client.query('COMMIT');

            return {
                id: dbResult.rows[0].id,
                fileName: file.originalname,
                fileUrl: publicUrl,
                recordType
            };
        } catch (error) {
            await client.query('ROLLBACK');

            if (filePath) {
                try {
                    fs.rmSync(diskPath(filePath), { force: true });
                } catch (cleanupError) {
                    console.error('Failed to cleanup storage file:', cleanupError);
                }
            }

            throw error;
        } finally {
            client.release();

            if (file.path) {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Failed to delete temp file:', err);
                });
            }
        }
    }

    async getUserFiles(userId) {
        const result = await pool.query(
            `SELECT id, file_name, record_type, uploaded_at, file_path
             FROM medical_records
             WHERE user_id = $1
             ORDER BY uploaded_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async getFileById(fileId) {
        const result = await pool.query(
            `SELECT file_path, file_name, user_id
             FROM medical_records
             WHERE id = $1`,
            [fileId]
        );
        return result.rows[0];
    }

    async checkFileAccess(fileId, userId, userRole) {
        const file = await this.getFileById(fileId);

        if (!file) {
            throw new Error('File not found');
        }

        if (file.user_id === userId) {
            return file;
        }

        if (userRole === "doctor") {
            const permissionCheck = await pool.query(
                `SELECT a.id FROM appointments a
                 WHERE a.doctor_id = $1 AND a.user_id = $2
                   AND a.records_allowed = true
                 LIMIT 1`,
                [userId, file.user_id]
            );

            if (!permissionCheck.rows.length) {
                throw new Error('Access denied');
            }
            return file;
        }

        throw new Error('Access denied');
    }

    async downloadFile(file) {
        const localPath = diskPath(relativePathFromUrl(file.file_path));
        if (!fs.existsSync(localPath)) throw new Error('File not found in storage');
        const fileBuffer = fs.readFileSync(localPath);

        return {
            buffer: fileBuffer,
            contentType: 'application/octet-stream',
            fileName: file.file_name,
            fileSize: fileBuffer.length
        };
    }

    async validateFileUpload(file) {
        if (!file) {
            throw new Error('No file uploaded');
        }

        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (!mimetype || !extname) {
            throw new Error('Only images, PDFs, and Word documents are allowed');
        }

        if (file.size > 10 * 1024 * 1024) {
            throw new Error('File size must be less than 10MB');
        }

        return true;
    }

    async getFileStream(filePath) {
        return fs.createReadStream(diskPath(relativePathFromUrl(filePath)));
    }

    async deleteFile(fileId, userId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const file = await client.query(
                `SELECT file_path, user_id FROM medical_records WHERE id = $1 AND user_id = $2`,
                [fileId, userId]
            );

            if (!file.rows.length) {
                throw new Error('File not found');
            }

            const filePath = file.rows[0].file_path;
            fs.rmSync(diskPath(relativePathFromUrl(filePath)), { force: true });

            await client.query(
                'DELETE FROM medical_records WHERE id = $1 AND user_id = $2',
                [fileId, userId]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new FileService();
