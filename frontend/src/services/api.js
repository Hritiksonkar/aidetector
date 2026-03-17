import axios from 'axios'

const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Only use the full production URL if we are NOT on localhost.
// This allows the Vite proxy to work correctly during local development.
const rawBaseURL = isLocal ? '' : (import.meta.env.VITE_API_BASE_URL || 'https://aidetector-i61w.onrender.com');
const baseURL = rawBaseURL.replace(/\/$/, '');

// Use this for rendering backend-hosted assets (e.g. `/uploads/<file>`).
// In local dev, `baseURL === ''` and Vite proxies `/uploads` to the backend.
export const API_BASE_URL = baseURL;

export function resolveApiUrl(url) {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (!API_BASE_URL) return url;
    return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const api = axios.create({
    baseURL,
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export function setAuthToken(token) {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
}

export async function login(payload) {
    const { data } = await api.post('/api/auth/login', payload)
    return data
}

export async function register(payload) {
    const { data } = await api.post('/api/auth/register', payload)
    return data
}

export async function uploadForDetection(file) {
    const form = new FormData()
    form.append('file', file)

    const { data } = await api.post('/api/detect/upload', form)

    return data
}

export async function detectVideoFromUrl(url) {
    const { data } = await api.post('/api/detect/url', { url })
    return data
}

export async function fetchHistory() {
    const { data } = await api.get('/api/detect/history')
    return data
}
