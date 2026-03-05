const express = require("express");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const Chat = require("../models/Chat");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// ==============================
// SEND MESSAGE TO AI
// ==============================

router.post("/chat", authMiddleware, async (req, res) => {

  try {

    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        message: "message and sessionId are required"
      });
    }

    const userId = req.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // find or create chat
    let chat = await Chat.findOne({ sessionId, userId });

    if (!chat) {
      chat = new Chat({
        userId,
        sessionId,
        messages: []
      });
    }

    // ==========================
    // SAVE USER MESSAGE
    // ==========================

    chat.messages.push({
      role: "user",
      content: message
    });

    await chat.save();

    // ==========================
    // CALL AI AGENT
    // ==========================

    let answer = "AI could not generate a response.";

    try {

      const aiResponse = await axios.post(`${process.env.AI_AGENT_URL}/chat`, {
  message,
  session_id: sessionId,
  city: user.location
});

      answer =
        aiResponse?.data?.response ||
        "AI could not generate a response.";

    } catch (aiError) {

      console.error("AI service error:", aiError.message);

      answer = "AI service is temporarily unavailable.";

    }

    // ==========================
    // SAVE AI RESPONSE
    // ==========================

    chat.messages.push({
      role: "assistant",
      content: answer
    });

    await chat.save();

    res.json({
      response: answer
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: "AI chat failed",
      error: err.message
    });

  }

});


// ==============================
// GET CHAT MESSAGES
// ==============================

router.get("/chat/:sessionId", authMiddleware, async (req, res) => {

  try {

    const { sessionId } = req.params;

    const chat = await Chat.findOne({
      sessionId,
      userId: req.userId
    });

    if (!chat) {
      return res.json({ messages: [] });
    }

    res.json({
      messages: chat.messages
    });

  } catch (err) {

    res.status(500).json({
      message: "Failed to load chat history"
    });

  }

});


// ==============================
// GET USER CHAT SESSIONS
// ==============================

router.get("/chats", authMiddleware, async (req, res) => {

  try {

    const chats = await Chat.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("sessionId createdAt");

    res.json(chats);

  } catch (err) {

    res.status(500).json({
      message: "Failed to load chats"
    });

  }

});


// ==============================
// CREATE NEW CHAT SESSION
// ==============================

router.post("/new-session", authMiddleware, async (req, res) => {

  try {

    const sessionId = uuidv4();

    const chat = new Chat({
      userId: req.userId,
      sessionId,
      messages: []
    });

    await chat.save();

    res.json({
      sessionId
    });

  } catch (err) {

    res.status(500).json({
      message: "Failed to create session"
    });

  }

});

module.exports = router;