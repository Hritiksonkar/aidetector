import axios from 'axios';

// In dev, prefer same-origin requests so Vite can proxy `/api` to the backend.
// In prod, set `VITE_API_BASE_URL` if frontend and backend are on different origins.
const baseURL =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? '' : 'http://localhost:5000');

export const api = axios.create({
    baseURL,
    timeout: 15000
});

const TEXT_TIMEOUT_MS = 60_000;
const NEWS_TIMEOUT_MS = 180_000;
const VIDEO_TIMEOUT_MS = 180_000;

function normalizeConfidence(confidence) {
    const n = Number(confidence);
    if (!Number.isFinite(n)) return 0;
    // Accept 0..1 or 0..100
    if (n <= 1) return Math.round(n * 100);
    if (n <= 100) return Math.round(n);
    return 100;
}

export function normalizeDetectResponse(data) {
    const result = data?.result;
    const confidence = normalizeConfidence(data?.confidence);
    const safeResult = result === 'Real' || result === 'Fake' ? result : 'Fake';
    return { result: safeResult, confidence };
}

export async function detectText(text) {
    const res = await api.post('/api/detect/text', { text }, { timeout: TEXT_TIMEOUT_MS });
    return normalizeDetectResponse(res.data);
}

export async function detectNews(text) {
    const res = await api.post('/api/detect/news', { text }, { timeout: NEWS_TIMEOUT_MS });
    return normalizeDetectResponse(res.data);
}

export async function detectVideo(videoUrl) {
    const res = await api.post('/api/detect/video', { videoUrl }, { timeout: VIDEO_TIMEOUT_MS });
    return normalizeDetectResponse(res.data);
}

export async function detectImage(file) {
    const form = new FormData();
    form.append('image', file);
    const res = await api.post('/api/detect/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return normalizeDetectResponse(res.data);
}
