const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { config } = require('../config/env');

const SIGHTENGINE_CHECK_URL = 'https://api.sightengine.com/1.0/check.json';

function _pickFirstNumber(value) {
    if (value === undefined || value === null) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
}

function _extractFakeProbability(data) {
    // Sightengine responses vary by model. We try to extract a single probability
    // that represents "manipulated / AI / deepfake" likelihood.
    const type = data?.type;

    if (type && typeof type === 'object') {
        const direct = _pickFirstNumber(type.deepfake) ?? _pickFirstNumber(type.ai_generated);
        if (direct !== undefined) return direct;

        const knownKeys = ['fake', 'manipulated', 'synthetic', 'generated', 'ai', 'deepfake'];
        for (const key of knownKeys) {
            if (Object.prototype.hasOwnProperty.call(type, key)) {
                const v = _pickFirstNumber(type[key]);
                if (v !== undefined) return v;
            }
        }

        // Fallback: first numeric value in `type` object.
        for (const v of Object.values(type)) {
            const n = _pickFirstNumber(v);
            if (n !== undefined) return n;
        }
    }

    // Some models might return a top-level numeric field.
    const topLevelCandidates = ['deepfake', 'ai_generated', 'fake', 'score', 'prob'];
    for (const k of topLevelCandidates) {
        const n = _pickFirstNumber(data?.[k]);
        if (n !== undefined) return n;
    }

    return undefined;
}

function normalizeSightengineResult(data) {
    const fakeProb = _extractFakeProbability(data);
    if (fakeProb === undefined) {
        const err = new Error('Sightengine response did not include a recognizable score');
        err.statusCode = 502;
        err.details = {
            message: 'Unexpected Sightengine response format',
            keys: Object.keys(data || {})
        };
        throw err;
    }

    const p = Math.max(0, Math.min(1, fakeProb));
    const result = p >= 0.5 ? 'Fake' : 'Real';
    const confidence = Math.max(p, 1 - p);

    return { result, confidence };
}

async function detectImage(filePath, originalName = 'image') {
    if (!config.sightengineUser || !config.sightengineSecret) {
        const err = new Error('Sightengine credentials are not configured');
        err.statusCode = 500;
        err.details = {
            hint: 'Set SIGHTENGINE_USER and SIGHTENGINE_SECRET in backend/.env'
        };
        throw err;
    }

    const form = new FormData();
    form.append('models', config.sightengineModels);
    form.append('api_user', config.sightengineUser);
    form.append('api_secret', config.sightengineSecret);
    form.append('media', fs.createReadStream(filePath), { filename: originalName });

    // Avoid logging credentials.
    console.log('[sightengine] detectImage -> check.json (models=%s)', config.sightengineModels);

    const response = await axios.post(SIGHTENGINE_CHECK_URL, form, {
        timeout: config.sightengineTimeoutMs,
        headers: {
            ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: (status) => status >= 200 && status < 500
    });

    // Sightengine error format usually contains `error`.
    if (response.status >= 400 || response.data?.error) {
        const err = new Error('Sightengine API error');
        err.statusCode = 502;
        err.details = {
            status: response.status,
            data: response.data
        };
        throw err;
    }

    return normalizeSightengineResult(response.data);
}

module.exports = {
    detectImage
};
