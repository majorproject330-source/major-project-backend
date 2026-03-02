const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  text: {
    type: String,
    default: ""
  },
  imageUrl: {
    type: String,
    default: ""
  }
}, { timestamps: true });

postSchema.index({ city: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);