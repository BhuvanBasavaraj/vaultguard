const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    draftText: { type: String, required: true },
    violations: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    healthScore: { type: Number, required: true },
    scannedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);