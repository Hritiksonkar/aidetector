const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function protect(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const [scheme, token] = header.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        req.user = { id: user._id.toString() };
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Not authorized' });
    }
}

module.exports = { protect };
