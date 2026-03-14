const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const Upload = require('../models/Upload');
const { asyncHandler } = require('../utils/asyncHandler');
const { scoreToVerdict } = require('../utils/verdict');
const { detectFile } = require('../services/aiDetectorService');

function getMaxUploadBytes() {
    const raw = process.env.MAX_UPLOAD_SIZE_BYTES;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 100 * 1024 * 1024;
}

const allowedMimes = new Set(['image/jpeg', 'image/png', 'video/mp4']);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const safeOriginal = (file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
        const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}_${safeOriginal}`);
    }
});

function fileFilter(req, file, cb) {
    if (!allowedMimes.has(file.mimetype)) {
        return cb(new Error('Invalid file type. Only jpg, png, mp4 are allowed.'));
    }
    return cb(null, true);
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: getMaxUploadBytes() }
});

const uploadMiddleware = upload.single('file');

function sanitizeFilename(name) {
    return (name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureUploadsDir() {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    return uploadsDir;
}

function getRemoteFilename(urlStr) {
    try {
        const u = new URL(urlStr);
        const base = u.pathname.split('/').filter(Boolean).pop();
        return sanitizeFilename(base || 'remote.mp4');
    } catch {
        return 'remote.mp4';
    }
}

async function downloadToFile(urlStr, destPath, maxBytes) {
    const resp = await axios.get(urlStr, {
        responseType: 'stream',
        timeout: 30_000,
        maxRedirects: 5,
        validateStatus: () => true
    });

    if (resp.status === 404) {
        const err = new Error('Video not found at the provided link.');
        err.statusCode = 404;
        throw err;
    }

    if (resp.status < 200 || resp.status >= 300) {
        const err = new Error('Unable to fetch video from the provided link.');
        err.statusCode = 400;
        throw err;
    }

    const contentType = String(resp.headers?.['content-type'] || '').toLowerCase();
    const contentLength = Number(resp.headers?.['content-length']);

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        const err = new Error('Video is too large.');
        err.statusCode = 413;
        throw err;
    }

    // Only support mp4 for now (matches the existing upload allow-list)
    if (!contentType.includes('video/mp4')) {
        const err = new Error('Unsupported video type. Only MP4 links are supported.');
        err.statusCode = 400;
        throw err;
    }

    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(destPath);
        let total = 0;
        let finished = false;

        const cleanup = (error) => {
            if (finished) return;
            finished = true;
            try {
                out.close();
            } catch {
                // ignore
            }
            if (fs.existsSync(destPath)) {
                try {
                    fs.unlinkSync(destPath);
                } catch {
                    // ignore
                }
            }
            reject(error);
        };

        resp.data.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                const err = new Error('Video is too large.');
                err.statusCode = 413;
                resp.data.destroy(err);
                out.destroy(err);
            }
        });

        resp.data.on('error', cleanup);
        out.on('error', cleanup);

        out.on('finish', () => {
            if (finished) return;
            finished = true;
            resolve();
        });

        resp.data.pipe(out);
    });

    return { contentType };
}

const uploadAndDetect = asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded. Field name must be "file".' });
    }

    const mimeType = req.file.mimetype;
    const fileType = mimeType.startsWith('image/') ? 'image' : 'video';

    const detection = await detectFile({
        filePath: req.file.path,
        mimeType,
        originalName: req.file.originalname
    });

    const rawScore = typeof detection === 'number' ? detection : detection?.score;
    const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
    const source = typeof detection === 'object' ? detection?.source : undefined;
    const explanation = typeof detection === 'object' ? detection?.explanation : undefined;

    const verdict = scoreToVerdict(score);
    const fileUrl = `/uploads/${req.file.filename}`;

    const record = await Upload.create({
        userId: req.user.id,
        fileUrl,
        fileType,
        aiScore: score,
        verdict
    });

    return res.status(201).json({
        id: record._id.toString(),
        fileType,
        ai_probability: score,
        verdict,
        fileUrl,
        source,
        explanation
    });
});

const urlAndDetect = asyncHandler(async (req, res) => {
    const url = String(req.body?.url || '').trim();
    if (!url) {
        return res.status(400).json({ message: 'Video URL is required.' });
    }

    const uploadsDir = ensureUploadsDir();
    const originalName = getRemoteFilename(url);
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const safeOriginal = sanitizeFilename(originalName);
    const filename = `${unique}_${safeOriginal}`;
    const filePath = path.join(uploadsDir, filename);

    const maxBytes = getMaxUploadBytes();

    let mimeType = 'video/mp4';
    try {
        const dl = await downloadToFile(url, filePath, maxBytes);
        mimeType = dl.contentType || mimeType;
    } catch (err) {
        return res.status(err.statusCode || 400).json({ message: err.message || 'Failed to download video.' });
    }

    const detection = await detectFile({ filePath, mimeType, originalName: safeOriginal });
    const rawScore = typeof detection === 'number' ? detection : detection?.score;
    const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
    const source = typeof detection === 'object' ? detection?.source : undefined;
    const explanation = typeof detection === 'object' ? detection?.explanation : undefined;

    const verdict = scoreToVerdict(score);
    const fileUrl = `/uploads/${filename}`;

    const record = await Upload.create({
        userId: req.user.id,
        fileUrl,
        fileType: 'video',
        aiScore: score,
        verdict
    });

    return res.status(201).json({
        id: record._id.toString(),
        fileType: 'video',
        ai_probability: score,
        verdict,
        fileUrl,
        source,
        explanation
    });
});

const history = asyncHandler(async (req, res) => {
    const items = await Upload.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    return res.json({
        count: items.length,
        items: items.map((x) => ({
            id: x._id.toString(),
            fileUrl: x.fileUrl,
            fileType: x.fileType,
            aiScore: x.aiScore,
            verdict: x.verdict,
            createdAt: x.createdAt
        }))
    });
});

module.exports = { uploadMiddleware, uploadAndDetect, urlAndDetect, history };
