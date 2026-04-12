const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { config } = require('./config/env');
const detectRoutes = require('./routes/detectRoutes');
const { loggingMiddleware } = require('./middleware/logging');
const { createRateLimiter } = require('./middleware/rateLimit');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(loggingMiddleware());
app.use(createRateLimiter());

app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'ok' });
});

app.use('/api', detectRoutes);

// 404 handler
app.use((req, res) => {
    return res.status(404).json({
        error: 'Not Found',
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

// Error handler
app.use((err, req, res, _next) => {
    const status = err?.statusCode || err?.status || 500;

    const axiosStatus = err?.response?.status;
    const axiosData = err?.response?.data;

    console.log('[error]', {
        status,
        message: err?.message,
        stack: config.nodeEnv === 'production' ? undefined : err?.stack,
        axiosStatus,
        axiosData
    });

    if (err?.name === 'MulterError') {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid upload',
            details: [{ message: err.message, code: err.code }]
        });
    }

    const networkCode = err?.code || err?.cause?.code;
    const timeoutCodes = new Set(['ECONNABORTED']);
    if (timeoutCodes.has(networkCode)) {
        return res.status(504).json({
            error: 'Gateway Timeout',
            message: 'Python ML service timed out. The model may be downloading/loading on first request.',
            details: [{ code: networkCode, pythonApiBaseUrl: config.pythonApiBaseUrl }]
        });
    }

    const networkCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
    if (networkCodes.has(networkCode) || err?.cause instanceof AggregateError) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Python ML service is not reachable. Ensure ml-service is running at the configured base URL.',
            details: [{ code: networkCode || 'NETWORK_ERROR', pythonApiBaseUrl: config.pythonApiBaseUrl }]
        });
    }

    if (axiosStatus) {
        // If the ML service returns a 4xx, it's usually a client/input issue (bad URL, too large, etc.).
        // Preserve that status so the frontend can show a helpful message.
        if (axiosStatus >= 400 && axiosStatus < 500) {
            const msg =
                (axiosData && typeof axiosData === 'object' && axiosData.detail) ? String(axiosData.detail) :
                    (typeof axiosData === 'string' ? axiosData : 'Invalid request for Python ML service');

            return res.status(axiosStatus).json({
                error: 'Bad Request',
                message: msg,
                details: [{ status: axiosStatus, data: axiosData, pythonApiBaseUrl: config.pythonApiBaseUrl }]
            });
        }

        return res.status(502).json({
            error: 'Bad Gateway',
            message: 'Python ML service error',
            details: [{ status: axiosStatus, data: axiosData, pythonApiBaseUrl: config.pythonApiBaseUrl }]
        });
    }

    return res.status(status).json({
        error: status >= 500 ? 'Internal Server Error' : 'Error',
        message: err?.message || 'Unexpected error',
        details: err?.details
    });
});

const port = config.port;
const server = app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
    console.log(`[server] python api base url: ${config.pythonApiBaseUrl}`);
    console.log(`[server] uploads temp dir: ${path.resolve(process.cwd(), config.uploadTempDir)}`);
});

server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
        console.error(`[server] Port ${port} is already in use.`);
        console.error('[server] Stop the existing process on that port, or start with a different PORT (e.g. set PORT=5001).');
        process.exit(1);
    }
    console.error('[server] Failed to start server:', err);
    process.exit(1);
});
