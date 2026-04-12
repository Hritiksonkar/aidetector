const fs = require('fs/promises');
const Joi = require('joi');
const pythonService = require('../services/pythonService');
const sightengineService = require('../services/sightengineService');

const textSchema = Joi.object({
    text: Joi.string().trim().min(1).max(50_000).required()
});

const videoSchema = Joi.object({
    videoUrl: Joi.string().uri({ scheme: [/https?/] }).required()
});

function normalizePythonResult(data) {
    const result = data?.result;
    const confidence = data?.confidence;

    if (result !== 'Real' && result !== 'Fake') {
        return { result: 'Fake', confidence: 0.5 };
    }

    const confNum = Number(confidence);
    return {
        result,
        confidence: Number.isFinite(confNum) ? confNum : 0.5
    };
}

async function detectText(req, res, next) {
    try {
        const { error } = textSchema.validate(req.body, { abortEarly: false });
        if (error) {
            console.log('[detectText] validation error:', error.details.map((d) => d.message));
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Validation failed',
                details: error.details.map((d) => ({ message: d.message, path: d.path }))
            });
        }

        const { text } = req.body;
        const data = await pythonService.detectText(text);
        const normalized = normalizePythonResult(data);

        return res.status(200).json(normalized);
    } catch (err) {
        console.log('[detectText] error:', err?.message || err);
        return next(err);
    }
}

async function detectNews(req, res, next) {
    try {
        const { error } = textSchema.validate(req.body, { abortEarly: false });
        if (error) {
            console.log('[detectNews] validation error:', error.details.map((d) => d.message));
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Validation failed',
                details: error.details.map((d) => ({ message: d.message, path: d.path }))
            });
        }

        const { text } = req.body;
        const data = await pythonService.detectNews(text);
        const normalized = normalizePythonResult(data);

        return res.status(200).json(normalized);
    } catch (err) {
        console.log('[detectNews] error:', err?.message || err);
        return next(err);
    }
}

async function detectVideo(req, res, next) {
    try {
        const { error } = videoSchema.validate(req.body, { abortEarly: false });
        if (error) {
            console.log('[detectVideo] validation error:', error.details.map((d) => d.message));
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Validation failed',
                details: error.details.map((d) => ({ message: d.message, path: d.path }))
            });
        }

        const { videoUrl } = req.body;
        const data = await pythonService.detectVideo(videoUrl);
        const normalized = normalizePythonResult(data);

        return res.status(200).json(normalized);
    } catch (err) {
        console.log('[detectVideo] error:', err?.message || err);
        return next(err);
    }
}

async function detectImage(req, res, next) {
    const uploaded = req.file;
    try {
        if (!uploaded) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Image file is required (field name: image)'
            });
        }

        const normalized = await sightengineService.detectImage(uploaded.path, uploaded.originalname);
        return res.status(200).json(normalized);
    } catch (err) {
        console.log('[detectImage] error:', err?.message || err);
        return next(err);
    } finally {
        if (uploaded?.path) {
            try {
                await fs.unlink(uploaded.path);
            } catch (e) {
                console.log('[detectImage] cleanup failed:', e?.message || e);
            }
        }
    }
}

module.exports = {
    detectText,
    detectNews,
    detectImage,
    detectVideo
};
