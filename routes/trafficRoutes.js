const express = require("express");
const axios = require("axios");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");

const router = express.Router();

/* =====================================================
   GET TRAFFIC DATA
===================================================== */
router.get("/trafficData", authMiddleware, async (req, res) => {
  try {
    let location = req.query.city;

    // 1️⃣ DB location
    if (!location) {
      const user = await User.findById(req.userId);
      location = user?.location;
    }

    // 2️⃣ IP fallback
    if (!location) {
      const ipRes = await axios.get("https://ipapi.co/json/");
      location = ipRes.data.city;
    }

    if (!location) {
      return res.status(400).json({ message: "City not found" });
    }

    // Convert city → lat/lon
    const geoRes = await axios.get(
      "https://api.openweathermap.org/geo/1.0/direct",
      {
        params: {
          q: location,
          limit: 1,
          appid: process.env.OPENWEATHER_KEY
        }
      }
    );

    if (!geoRes.data.length) {
      return res.status(400).json({ message: "Invalid city" });
    }

    const { lat, lon } = geoRes.data[0];

    // TomTom Traffic Flow
    const flowRes = await axios.get(
      "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json",
      {
        params: {
          key: process.env.TOMTOM_API_KEY,
          point: `${lat},${lon}`,
          unit: "KMPH"
        }
      }
    );

    const flow = flowRes.data.flowSegmentData;

    const delay =
      flow.currentTravelTime - flow.freeFlowTravelTime;

    const ratio = flow.currentSpeed / flow.freeFlowSpeed;

    const congestion =
      ratio >= 0.8
        ? "Low"
        : ratio >= 0.5
        ? "Moderate"
        : ratio >= 0.3
        ? "High"
        : "Severe";

    res.json({
      city: location,
      lat,
      lon,
      current_speed: flow.currentSpeed,
      normal_speed: flow.freeFlowSpeed,
      delay,
      congestion
    });

  } catch (err) {
    // console.error(err.message);
    res.status(500).json({ message: "Traffic fetch failed" });
  }
});


module.exports = router;