const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
let ytdlp = null;
try {
    // Optional dependency used for platform video URLs (YouTube/Instagram/Facebook/etc.)
    // If not installed, direct MP4 links still work.
    // eslint-disable-next-line global-require
    ytdlp = require('yt-dlp-exec');
} catch {
    ytdlp = null;
}
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
        try {
            cb(null, ensureUploadsDir());
        } catch (e) {
            cb(e);
        }
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

function isPrivateIp(ip) {
    const ipType = net.isIP(ip);
    if (!ipType) return false;

    if (ipType === 4) {
        const parts = ip.split('.').map((x) => Number(x));
        if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 192 && b === 168) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
        return false;
    }

    // IPv6
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
        return true; // fe80::/10
    }
    return false;
}

async function assertSafeRemoteUrl(urlStr) {
    let u;
    try {
        u = new URL(urlStr);
    } catch {
        const err = new Error('Valid URL is required.');
        err.statusCode = 400;
        throw err;
    }

    if (!['http:', 'https:'].includes(u.protocol)) {
        const err = new Error('Only http/https URLs are supported.');
        err.statusCode = 400;
        throw err;
    }

    if (u.username || u.password) {
        const err = new Error('URLs with embedded credentials are not allowed.');
        err.statusCode = 400;
        throw err;
    }

    const hostname = (u.hostname || '').trim();
    if (!hostname) {
        const err = new Error('Valid URL is required.');
        err.statusCode = 400;
        throw err;
    }

    const lower = hostname.toLowerCase();
    if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.localhost')) {
        const err = new Error('Localhost URLs are not allowed.');
        err.statusCode = 400;
        throw err;
    }

    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
            const err = new Error('Private network URLs are not allowed.');
            err.statusCode = 400;
            throw err;
        }
        return;
    }

    let addrs = [];
    try {
        addrs = await dns.lookup(hostname, { all: true });
    } catch {
        // If DNS fails, let the downloader handle it.
        return;
    }

    if (addrs.some((a) => isPrivateIp(a.address))) {
        const err = new Error('Private network URLs are not allowed.');
        err.statusCode = 400;
        throw err;
    }
}

function mimeFromPath(filePath) {
    const ext = path.extname(filePath || '').toLowerCase();
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.webm') return 'video/webm';
    if (ext === '.mov') return 'video/quicktime';
    if (ext === '.mkv') return 'video/x-matroska';
    if (ext === '.avi') return 'video/x-msvideo';
    return 'video/mp4';
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

    // For URL scanning, allow any video/* content-type (uploads are still restricted by multer)
    if (contentType) {
        if (!contentType.includes('video/')) {
            const err = new Error('Unsupported content type. Please provide a video link.');
            err.statusCode = 400;
            throw err;
        }
    } else {
        // Some CDNs omit content-type on redirects; require a known extension in the URL path.
        let ext = '';
        try {
            const u = new URL(urlStr);
            ext = path.extname(u.pathname || '').toLowerCase();
        } catch {
            ext = '';
        }
        const okExt = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);
        if (!okExt.has(ext)) {
            const err = new Error('Unsupported content type. Please provide a direct video file URL or a platform link.');
            err.statusCode = 400;
            throw err;
        }
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

async function downloadViaYtDlp(urlStr, uploadsDir, uniqueBase, maxBytes) {
    if (!ytdlp) {
        const err = new Error(
            'This server is not configured to download platform video links yet. Install yt-dlp support (npm i yt-dlp-exec) or provide a direct video file URL.'
        );
        err.statusCode = 501;
        throw err;
    }

    const maxMb = Math.max(1, Math.floor(maxBytes / (1024 * 1024)));
    const outputTemplate = path.join(uploadsDir, `${uniqueBase}.%(ext)s`);

    try {
        await ytdlp(urlStr, {
            output: outputTemplate,
            format: 'best[ext=mp4]/best',
            noPlaylist: true,
            restrictFilenames: true,
            noPart: true,
            maxFilesize: `${maxMb}M`
        });
    } catch (e) {
        const msg = String(e?.stderr || e?.message || '').trim();
        const err = new Error(
            msg
                ? `Unable to download video from the provided link. ${msg}`
                : 'Unable to download video from the provided link.'
        );
        err.statusCode = 400;
        throw err;
    }

    const files = await fs.promises.readdir(uploadsDir);
    const matches = files.filter((f) => f.startsWith(`${uniqueBase}.`));
    if (!matches.length) {
        const err = new Error('Downloaded video file could not be located.');
        err.statusCode = 500;
        throw err;
    }

    // Prefer mp4 if present
    const picked = matches.find((f) => f.toLowerCase().endsWith('.mp4')) || matches[0];
    const fullPath = path.join(uploadsDir, picked);

    let stat;
    try {
        stat = await fs.promises.stat(fullPath);
    } catch {
        const err = new Error('Downloaded video file could not be read.');
        err.statusCode = 500;
        throw err;
    }

    if (stat.size > maxBytes) {
        try {
            await fs.promises.unlink(fullPath);
        } catch {
            // ignore
        }
        const err = new Error('Video is too large.');
        err.statusCode = 413;
        throw err;
    }

    return {
        filePath: fullPath,
        filename: picked,
        mimeType: mimeFromPath(fullPath)
    };
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

    await assertSafeRemoteUrl(url);

    const uploadsDir = ensureUploadsDir();
    const originalName = getRemoteFilename(url);
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const safeOriginal = sanitizeFilename(originalName);
    const filename = `${unique}_${safeOriginal}`;
    const directPath = path.join(uploadsDir, filename);

    const maxBytes = getMaxUploadBytes();

    let filePath = directPath;
    let mimeType = 'video/mp4';
    let finalFilename = filename;

    try {
        const dl = await downloadToFile(url, directPath, maxBytes);
        mimeType = dl.contentType || mimeType;
        // If server didn't provide a video/* content-type, fall back to extension-based.
        if (!String(mimeType || '').toLowerCase().includes('video/')) {
            mimeType = mimeFromPath(directPath);
        }
    } catch (err) {
        // If direct download fails (common for YouTube/Instagram/Facebook), try yt-dlp.
        try {
            // Remove any partially created direct file.
            if (fs.existsSync(directPath)) {
                try {
                    fs.unlinkSync(directPath);
                } catch {
                    // ignore
                }
            }

            const dl2 = await downloadViaYtDlp(url, uploadsDir, unique, maxBytes);
            filePath = dl2.filePath;
            finalFilename = dl2.filename;
            mimeType = dl2.mimeType;
        } catch (fallbackErr) {
            const status = fallbackErr.statusCode || err.statusCode || 400;
            const msg = fallbackErr.message || err.message || 'Failed to download video.';
            return res.status(status).json({ message: msg });
        }
    }

    const detection = await detectFile({ filePath, mimeType, originalName: safeOriginal || finalFilename });
    const rawScore = typeof detection === 'number' ? detection : detection?.score;
    const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
    const source = typeof detection === 'object' ? detection?.source : undefined;
    const explanation = typeof detection === 'object' ? detection?.explanation : undefined;

    const verdict = scoreToVerdict(score);
    const fileUrl = `/uploads/${finalFilename}`;

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
