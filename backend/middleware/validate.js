function validate(schema, property = 'body') {
    return async (req, res, next) => {
        try {
            const { value, error } = schema.validate(req[property], {
                abortEarly: false,
                stripUnknown: true,
                convert: true
            });

            if (error) {
                console.log('[validation] failed:', error.details.map((d) => d.message));
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Validation failed',
                    details: error.details.map((d) => ({ message: d.message, path: d.path }))
                });
            }

            req[property] = value;
            return next();
        } catch (err) {
            return next(err);
        }
    };
}

module.exports = { validate };
