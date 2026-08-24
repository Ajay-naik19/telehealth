const { pool } = require('../../config/database');
const VaultModel = require('./vault.model');
const { AppError } = require('../../utils/AppError');
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
    if (!url.pathname.startsWith(prefix)) throw new AppError('Invalid local file path', 400);
    return decodeURIComponent(url.pathname.slice(prefix.length));
}

class VaultService {
    validateFileUpload(file) {
        if (!file) throw new AppError('No file uploaded', 400);

        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (!mimetype || !extname) {
            throw new AppError('Only images, PDFs, and Word documents are allowed', 400);
        }

        if (file.size > 10 * 1024 * 1024) {
            throw new AppError('File size must be less than 10MB', 400);
        }

        return true;
    }

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
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [userId, file.originalname, publicUrl, recordType, new Date().toISOString()]
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
        return VaultModel.findByUser(userId);
    }

    async checkFileAccess(fileId, userId, userRole) {
        const file = await VaultModel.findById(fileId);

        if (!file) throw new AppError('File not found', 404);

        if (file.user_id === userId) return file;

        if (userRole === 'doctor') {
            const hasPermission = await VaultModel.checkDoctorPermission(userId, file.user_id);
            if (!hasPermission) throw new AppError('Access denied', 403);
            return file;
        }

        throw new AppError('Access denied', 403);
    }

    async downloadFile(file) {
        const localPath = diskPath(relativePathFromUrl(file.file_path));
        if (!fs.existsSync(localPath)) throw new AppError('File not found in storage', 404);
        const fileBuffer = fs.readFileSync(localPath);

        return {
            buffer: fileBuffer,
            contentType: 'application/octet-stream',
            fileName: file.file_name,
            fileSize: fileBuffer.length
        };
    }

    async deleteFile(fileId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const file = await VaultModel.findRecordForDelete(fileId, userId, client);
            if (!file) throw new AppError('File not found', 404);

            fs.rmSync(diskPath(relativePathFromUrl(file.file_path)), { force: true });

            await VaultModel.deleteRecord(fileId, userId, client);
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

module.exports = new VaultService();
