const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

function createRateLimiter() {
    return rateLimit({
        windowMs: config.rateLimitWindowMs,
        limit: config.rateLimitMax,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.'
        }
    });
}

module.exports = { createRateLimiter };
