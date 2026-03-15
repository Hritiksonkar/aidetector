const path = require('path');
const fs = require('fs');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const detectRoutes = require('./routes/detectRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();

const app = express();

// 1. Core Config
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// 2. Enhanced CORS (CRITICAL for production file uploads)
const corsOptions = {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // This handles the hidden "preflight" requests

// 3. Request Logging (Watch your Render dashboard for this)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// 4. Static Files & Root Health Check
app.get('/', (req, res) => res.send('<h1>Truth Shield API is Online</h1>'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/detect', detectRoutes);

// 6. Error Handling
app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

// Start server immediately (don't block on DB) to satisfy Render's port check
const server = app.listen(port, () => {
    console.log(`Truth Shield backend listening on :${port}`);
});

// Connect to DB in background
connectDB(process.env.MONGO_URI).catch(err => {
    console.error('Database connection failed:', err);
});
