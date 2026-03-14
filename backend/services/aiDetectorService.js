const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

function makeHttpError(message, statusCode, cause) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (cause) err.cause = cause;
    return err;
}

function normalizeScore(score) {
    const n = Number(score);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, n));
}

async function detectFile({ filePath, mimeType, originalName }) {
    const baseUrl = (process.env.PYTHON_AI_SERVICE_URL || '').replace(/\/$/, '');
    if (!baseUrl) {
        throw makeHttpError(
            'PYTHON_AI_SERVICE_URL is not set. Configure the Python AI service URL (e.g. http://127.0.0.1:8001).',
            500
        );
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
        filename: originalName || 'upload',
        contentType: mimeType
    });

    const url = `${baseUrl}/detect`;
    try {
        const resp = await axios.post(url, form, {
            headers: {
                ...form.getHeaders()
            },
            timeout: 60_000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        return {
            score: normalizeScore(resp.data?.score),
            source: resp.data?.source,
            explanation: resp.data?.explanation
        };
    } catch (e) {
        const code = e?.code;
        const status = e?.response?.status;

        if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') {
            throw makeHttpError(
                `AI detection service is unavailable at ${baseUrl}. Start backend/python_service (uvicorn main:app --host 127.0.0.1 --port 8001 --reload) and try again.`,
                503,
                e
            );
        }

        if (status >= 500) {
            throw makeHttpError(
                'AI detection service returned an error. Please try again shortly.',
                502,
                e
            );
        }

        throw makeHttpError(
            e?.response?.data?.detail || e?.message || 'AI detection failed.',
            status || 500,
            e
        );
    }
}

module.exports = { detectFile };
