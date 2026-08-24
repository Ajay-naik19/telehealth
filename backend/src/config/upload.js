const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ALLOWED_FILE_MIMES, ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE } = require('../middleware/validation');

const uploadDir = path.join(process.cwd(), 'temp_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const validExt = ALLOWED_FILE_EXTENSIONS.includes(ext);
        const validMime = ALLOWED_FILE_MIMES.includes(file.mimetype);
        if (validExt && validMime) {
            cb(null, true);
        } else {
            cb(new Error('Only images, PDFs, and Word documents are allowed'));
        }
    }
});

function createCleanupMiddleware() {
    return (req, res, next) => {
        const originalSend = res.send;
        res.send = function (data) {
            if (req.file?.path) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Cleanup failed:', err.message);
                });
            }
            return originalSend.call(this, data);
        };
        next();
    };
}

module.exports = {
    upload,
    createCleanupMiddleware
};