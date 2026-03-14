const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { asyncHandler } = require('../utils/asyncHandler');
const User = require('../models/User');

function signToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
}

const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed });

    const token = signToken(user._id.toString());
    return res.status(201).json({
        token,
        user: { id: user._id.toString(), name: user.name, email: user.email }
    });
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user._id.toString());
    return res.json({
        token,
        user: { id: user._id.toString(), name: user.name, email: user.email }
    });
});

module.exports = { register, login };
