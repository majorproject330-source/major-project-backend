const express = require("express");
const axios = require("axios");
const multer = require("multer");
const path = require("path");

const User = require("../models/User");
const Post = require("../models/Post");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/* =====================================
   MULTER CONFIGURATION
===================================== */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // make sure uploads folder exists
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* =====================================
   CREATE POST (UPDATED FOR IMAGE UPLOAD)
===================================== */

router.post(
  "/createPost",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const { text } = req.body;

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get city from DB → else IP
      let city = user.location?.trim().toLowerCase();

      if (!city) {
        const ipRes = await axios.get("https://ipapi.co/json/");
        city = ipRes.data.city;
      }

      if (!city) {
        return res.status(400).json({ message: "City not found" });
      }

      let imageUrl = "";

      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
      }

      const newPost = await Post.create({
        userId: user._id,
        userName: user.email,
        city,
        text,
        imageUrl,
      });

      res.status(201).json({
        message: "Post created successfully",
        post: newPost,
      });
    } catch (error) {
      res.status(500).json({ message: "Error creating post" });
    }
  }
);

/* =====================================
   GET POSTS
===================================== */

router.get("/getPosts", authMiddleware, async (req, res) => {
  try {
    let city = req.query.city;
    city = city?.trim().toLowerCase();
    if (!city) {
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      city = user.location;

      if (!city) {
        const ipRes = await axios.get("https://ipapi.co/json/");
        city = ipRes.data.city;
      }
    }

    if (!city) {
      return res.status(400).json({ message: "City not found" });
    }

    const posts = await Post.find({ city }).sort({
      createdAt: -1,
    });

    res.json({
      city,
      totalPosts: posts.length,
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

/* =====================================
   DELETE POST
===================================== */

router.delete(
  "/deletePost/:postId",
  authMiddleware,
  async (req, res) => {
    try {
      const { postId } = req.params;

      const post = await Post.findById(postId);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.userId.toString() !== req.userId) {
        return res
          .status(403)
          .json({ message: "You can only delete your own posts" });
      }

      await Post.findByIdAndDelete(postId);

      res.json({ message: "Post deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting post" });
    }
  }
);

module.exports = router;