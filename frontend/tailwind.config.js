/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: '#4F46E5',
                secondary: '#6366F1',
                background: '#0F172A',
                text: '#E2E8F0',
            },
        },
    },
    plugins: [],
}
