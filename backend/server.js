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

// Trust the Render/Vercel proxy
app.set('trust proxy', 1);

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: '*', // Allows development and production frontends to connect
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`${req.method} ${req.url}`);
    }
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Ensure uploads directory exists (important for cloud deploys where the folder isn't committed).
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Diagnostic route to check if API is alive in production
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is reaching the server successfully', env: process.env.NODE_ENV });
});

app.use('/api/auth', authRoutes);
app.use('/api/detect', detectRoutes);

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
