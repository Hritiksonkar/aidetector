function notFound(req, res, next) {
    res.status(404);
    next(new Error(`Not Found - ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
    const statusFromRes = res.statusCode && res.statusCode !== 200 ? res.statusCode : null;
    const statusCode = statusFromRes || err.statusCode || 500;

    res.status(statusCode).json({
        message: err.message || 'Server error',
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
}

module.exports = { notFound, errorHandler };
