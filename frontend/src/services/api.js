import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

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
