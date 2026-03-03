// routes/adminRoutes.js

const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

/* =====================================
   GET POSTS (OPTIONAL CITY FILTER)
===================================== */
router.get("/posts", adminMiddleware, async (req, res) => {
  try {
    let { city } = req.query;

    let filter = {};

    if (city) {
      city = city.trim().toLowerCase();
      filter.city = city;
    }

    const posts = await Post.find(filter).sort({ createdAt: -1 });

    res.json({
      city: city || "All Cities",
      totalPosts: posts.length,
      posts,
    });

  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

/* =====================================
   DELETE ANY POST
===================================== */
router.delete("/deletePost/:id", adminMiddleware, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted by admin" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting post" });
  }
});

/* =====================================
   GET ALL USERS
===================================== */
router.get("/users", adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({
      totalUsers: users.length,
      users,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

/* =====================================
   DELETE USER (AND THEIR POSTS)
===================================== */
router.delete("/deleteUser/:id", adminMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Post.deleteMany({ userId: req.params.id });

    res.json({ message: "User and related posts deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user" });
  }
});

/* =====================================
   POSTS GROUPED BY CITY (Analytics)
===================================== */
router.get("/posts-by-city", adminMiddleware, async (req, res) => {
  try {
    const grouped = await Post.aggregate([
      {
        $group: {
          _id: "$city",
          totalPosts: { $sum: 1 },
        },
      },
      { $sort: { totalPosts: -1 } },
    ]);

    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: "Error grouping posts" });
  }
});

module.exports = router;