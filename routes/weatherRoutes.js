const express = require("express");
const axios = require("axios");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User"); // adjust path if needed

const router = express.Router();

/* =====================================================
   1️⃣ GET WEATHER (City optional → fallback logic)
===================================================== */
router.get("/weather", authMiddleware, async (req, res) => {
  try {
    let location = req.query.city;

    // If no city provided → try user saved location
    if (!location) {
      const user = await User.findById(req.userId);
      location = user?.location;
    }

    // If still no location → detect from IP
    if (!location) {
      const ipRes = await axios.get("https://ipapi.co/json/");
      location = ipRes.data.city;
    }

    if (!location) {
      return res.status(400).json({ message: "City not found" });
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: location,
          appid: process.env.OPENWEATHER_KEY,
          units: "metric"
        }
      }
    );

    const data = response.data;

    const weather = {
      city: data.name,
      temperature: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      wind_speed: data.wind.speed,
      description: data.weather[0].description,
      icon: data.weather[0].icon
    };

    res.json(weather);

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ message: "Failed to fetch weather data" });
  }
});




module.exports = router;