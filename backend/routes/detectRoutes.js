const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { detectLimiter } = require('../middleware/rateLimiters');
const { validateRequest } = require('../utils/validators');
const { uploadMiddleware, uploadAndDetect, history, urlAndDetect } = require('../controllers/detectController');

const router = express.Router();

router.post('/upload', protect, detectLimiter, uploadMiddleware, uploadAndDetect);
router.post(
	'/url',
	protect,
	detectLimiter,
	[body('url').isURL({ require_protocol: true }).withMessage('Valid URL is required')],
	validateRequest,
	urlAndDetect
);
router.get('/history', protect, detectLimiter, history);

module.exports = router;
