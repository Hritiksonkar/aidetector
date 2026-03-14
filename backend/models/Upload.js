const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        fileUrl: { type: String, required: true },
        fileType: { type: String, enum: ['image', 'video'], required: true },
        aiScore: { type: Number, min: 0, max: 10, required: true },
        verdict: { type: String, required: true }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Upload', uploadSchema);
