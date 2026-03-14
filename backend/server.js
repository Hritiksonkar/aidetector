const path = require('path');
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

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/detect', detectRoutes);

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;

(async () => {
    await connectDB(process.env.MONGO_URI);
    app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`Truth Shield backend listening on :${port}`);
    });
})().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
});
