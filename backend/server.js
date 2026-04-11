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
app.use((err, req, res, next) => {
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
    const networkCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
    if (networkCodes.has(networkCode) || err?.cause instanceof AggregateError) {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Python ML service is not reachable. Start ml-service on port 8000.',
            details: [{ code: networkCode || 'NETWORK_ERROR', pythonApiBaseUrl: config.pythonApiBaseUrl }]
        });
    }

    if (axiosStatus) {
        return res.status(502).json({
            error: 'Bad Gateway',
            message: 'Python ML service error',
            details: [{ status: axiosStatus, data: axiosData }]
        });
    }

    return res.status(status).json({
        error: status >= 500 ? 'Internal Server Error' : 'Error',
        message: err?.message || 'Unexpected error'
    });
});

const port = config.port;
app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
    console.log(`[server] python api base url: ${config.pythonApiBaseUrl}`);
    console.log(`[server] uploads temp dir: ${path.resolve(process.cwd(), config.uploadTempDir)}`);
});
