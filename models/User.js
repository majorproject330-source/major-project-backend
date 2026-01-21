const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    location: {
        type: String,
        default: ""
    },
    ageRange: {
        type: String,
        default: ""
    },
    disease: {
        type: String,
        default: ""
    },

    isPersonalized: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model("user", userSchema);