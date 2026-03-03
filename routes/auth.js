const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * REGISTER
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      email,
      password: hashedPassword,
    });

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * LOGIN
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    /* ===========================
       ADMIN LOGIN (Hardcoded)
    ============================ */
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const adminToken = jwt.sign(
        { id: "admin", role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token: adminToken,
        isAdmin: true,
      });
    }

    /* ===========================
       NORMAL USER LOGIN
    ============================ */

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: "user" },   // 🔥 role added
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      isAdmin: false,
      isPersonalized: user.isPersonalized,
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
/**
 * SAVE PERSONALIZATION
 */
router.post("/personalize", authMiddleware, async (req, res) => {
  try {
    const { location, ageRange, disease } = req.body;

    const user = await User.findById(req.userId);
    user.location = location?.trim().toLowerCase();
    user.ageRange = ageRange;
    user.disease = disease;
    user.isPersonalized = true;

    await user.save();

    res.json({ message: "Personalization saved" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;