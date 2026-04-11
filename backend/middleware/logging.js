const morgan = require('morgan');

function loggingMiddleware() {
    return morgan(':method :url :status :res[content-length] - :response-time ms');
}

module.exports = { loggingMiddleware };
