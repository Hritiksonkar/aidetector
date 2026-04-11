const express = require('express');
const { upload } = require('../middleware/upload');
const detectController = require('../controllers/detectController');

const router = express.Router();

router.post('/detect/text', detectController.detectText);
router.post('/detect/image', upload.single('image'), detectController.detectImage);
router.post('/detect/video', detectController.detectVideo);

module.exports = router;
