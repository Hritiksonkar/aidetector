const express = require('express');
const { body } = require('express-validator');
const { register, login } = require('../controllers/authController');
const { validateRequest } = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post(
    '/register',
    authLimiter,
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    validateRequest,
    register
);

router.post(
    '/login',
    authLimiter,
    [
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('password').notEmpty().withMessage('Password is required')
    ],
    validateRequest,
    login
);

module.exports = router;
