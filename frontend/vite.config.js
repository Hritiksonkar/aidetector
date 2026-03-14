import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
            '/uploads': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (!id) return undefined
                    const normalized = id.replace(/\\/g, '/')
                    if (!normalized.includes('/node_modules/')) return undefined

                    if (
                        normalized.includes('/node_modules/react/') ||
                        normalized.includes('/node_modules/react-dom/') ||
                        normalized.includes('/node_modules/react-router/') ||
                        normalized.includes('/node_modules/react-router-dom/')
                    ) {
                        return 'vendor-react'
                    }

                    if (normalized.includes('/node_modules/framer-motion/')) {
                        return 'vendor-motion'
                    }

                    if (normalized.includes('/node_modules/recharts/')) {
                        return 'vendor-recharts'
                    }

                    return 'vendor'
                },
            },
        },
    },
})
