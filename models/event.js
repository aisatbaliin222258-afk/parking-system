const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ["critical", "high", "medium", "low"],
        required: true
    },
    status: {
        type: String,
        enum: ["Active", "Resolved"],
        default: "Active"
    },
    plate: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);