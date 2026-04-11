const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { config } = require('../config/env');

const client = axios.create({
    baseURL: config.pythonApiBaseUrl,
    timeout: 15_000
});

async function detectText(text) {
    console.log('[pythonService] detectText -> /text');
    const response = await client.post('/text', { text });
    return response.data;
}

async function detectVideo(videoUrl) {
    console.log('[pythonService] detectVideo -> /video');
    const response = await client.post('/video', { videoUrl });
    return response.data;
}

async function detectImage(filePath, originalName = 'image') {
    console.log('[pythonService] detectImage -> /image');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
        filename: originalName
    });

    const response = await client.post('/image', form, {
        headers: {
            ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });

    return response.data;
}

module.exports = {
    detectText,
    detectImage,
    detectVideo
};
