const dotenv = require('dotenv');
const path = require('path');

// Always load the backend-local .env regardless of the process working directory.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function getEnv(name, fallback) {
    const value = process.env[name];
    if (value === undefined || value === '') return fallback;
    return value;
}

function getEnvNumber(name, fallback) {
    const raw = getEnv(name, undefined);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
    port: getEnvNumber('PORT', 5000),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    pythonApiBaseUrl: getEnv('PYTHON_API_BASE_URL', 'http://127.0.0.1:8000'),
    // Sightengine (used only for /api/detect/image)
    sightengineUser: getEnv('SIGHTENGINE_USER', ''),
    sightengineSecret: getEnv('SIGHTENGINE_SECRET', ''),
    sightengineModels: getEnv('SIGHTENGINE_MODELS', 'genai,deepfake'),
    sightengineTimeoutMs: getEnvNumber('SIGHTENGINE_TIMEOUT_MS', 60_000),
    rateLimitWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60_000),
    rateLimitMax: getEnvNumber('RATE_LIMIT_MAX', 60),
    uploadTempDir: getEnv('UPLOAD_TEMP_DIR', 'tmp/uploads'),
    maxImageSizeBytes: getEnvNumber('MAX_IMAGE_SIZE_BYTES', 5 * 1024 * 1024)
};

module.exports = { config };
