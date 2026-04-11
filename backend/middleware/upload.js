const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { config } = require('../config/env');

const uploadDir = path.resolve(process.cwd(), config.uploadTempDir);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}-${safeOriginal}`);
    }
});

function fileFilter(req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'));
    }
    return cb(null, true);
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.maxImageSizeBytes,
        files: 1
    }
});

module.exports = { upload };
