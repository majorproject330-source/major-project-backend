const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/* ===========================
   CPCB BREAKPOINT TABLES
=========================== */

const AQI_BREAKPOINTS = {
  pm2_5: [
    { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
    { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
    { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
    { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
    { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
    { cLow: 251, cHigh: 500, iLow: 401, iHigh: 500 },
  ],
  pm10: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
    { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
    { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
    { cLow: 431, cHigh: 600, iLow: 401, iHigh: 500 },
  ],
  no2: [
    { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
    { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
    { cLow: 81, cHigh: 180, iLow: 101, iHigh: 200 },
    { cLow: 181, cHigh: 280, iLow: 201, iHigh: 300 },
    { cLow: 281, cHigh: 400, iLow: 301, iHigh: 400 },
    { cLow: 401, cHigh: 1000, iLow: 401, iHigh: 500 },
  ],
  so2: [
    { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
    { cLow: 41, cHigh: 80, iLow: 51, iHigh: 100 },
    { cLow: 81, cHigh: 380, iLow: 101, iHigh: 200 },
    { cLow: 381, cHigh: 800, iLow: 201, iHigh: 300 },
    { cLow: 801, cHigh: 1600, iLow: 301, iHigh: 400 },
    { cLow: 1601, cHigh: 2000, iLow: 401, iHigh: 500 },
  ],
  co: [
    { cLow: 0, cHigh: 1, iLow: 0, iHigh: 50 },
    { cLow: 1.1, cHigh: 2, iLow: 51, iHigh: 100 },
    { cLow: 2.1, cHigh: 10, iLow: 101, iHigh: 200 },
    { cLow: 10.1, cHigh: 17, iLow: 201, iHigh: 300 },
    { cLow: 17.1, cHigh: 34, iLow: 301, iHigh: 400 },
    { cLow: 34.1, cHigh: 50, iLow: 401, iHigh: 500 },
  ],
  o3: [
    { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
    { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
    { cLow: 101, cHigh: 168, iLow: 101, iHigh: 200 },
    { cLow: 169, cHigh: 208, iLow: 201, iHigh: 300 },
    { cLow: 209, cHigh: 748, iLow: 301, iHigh: 400 },
    { cLow: 749, cHigh: 1000, iLow: 401, iHigh: 500 },
  ],
};

/* ===========================
   SUB-INDEX CALCULATION
=========================== */

function calculateSubIndex(value, pollutant) {
  if (value == null || AQI_BREAKPOINTS[pollutant] == null) return null;

  const breakpoints = AQI_BREAKPOINTS[pollutant];

  const bp = breakpoints.find(
    (b) => value >= b.cLow && value <= b.cHigh
  );

  if (!bp) return null;

  const subIndex =
    ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) *
      (value - bp.cLow) +
    bp.iLow;

  return Math.round(subIndex);
}

/* ===========================
   AQI CATEGORY
=========================== */

function getAQICategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

/* ===========================
   ROUTE
=========================== */

router.get("/airQualityData", authMiddleware, async (req, res) => {
  try {
    let location = req.query.city;

    if (!location) {
      const user = await User.findById(req.userId);
      location = user?.location;

      if (!location) {
        const ipRes = await axios.get("https://ipapi.co/json/");
        location = ipRes.data.city;
      }
    }

    if (!location) {
      return res.status(400).json({ message: "City not found" });
    }

    // Convert city → lat, lon
    const geoRes = await axios.get(
      "https://api.openweathermap.org/geo/1.0/direct",
      {
        params: {
          q: location,
          limit: 1,
          appid: process.env.OPENWEATHER_KEY,
        },
      }
    );

    if (!geoRes.data.length) {
      return res.status(400).json({ message: "Invalid city" });
    }

    const { lat, lon } = geoRes.data[0];

    // Fetch pollution data
    const airRes = await axios.get(
      "https://api.openweathermap.org/data/2.5/air_pollution",
      {
        params: { lat, lon, appid: process.env.OPENWEATHER_KEY },
      }
    );

    const components = airRes.data.list[0].components;

    // Round + convert units
    const pollutants = {
      pm2_5: Number(components.pm2_5?.toFixed(2)),
      pm10: Number(components.pm10?.toFixed(2)),
      no2: Number(components.no2?.toFixed(2)),
      so2: Number(components.so2?.toFixed(2)),
      co: Number((components.co / 1000)?.toFixed(2)), // µg → mg
      o3: Number(components.o3?.toFixed(2)),
    };

    // Calculate sub-indices
    const subIndices = {};
    for (let key in pollutants) {
      subIndices[key] = calculateSubIndex(pollutants[key], key);
    }

    // Filter valid sub-indices
    const validSubIndices = Object.entries(subIndices).filter(
      ([_, value]) => value != null
    );

    if (validSubIndices.length === 0) {
      return res.status(500).json({ message: "AQI calculation failed" });
    }

    // Final AQI = max sub-index
    const finalAQI = Math.max(...validSubIndices.map(([_, val]) => val));

    // Dominant pollutant
    const dominantPollutant = validSubIndices.reduce((prev, curr) =>
      curr[1] > prev[1] ? curr : prev
    )[0];

    const response = {
      location,
      aqi: {
        value: finalAQI,
        category: getAQICategory(finalAQI),
        source: "CPCB multi-pollutant formula",
      },
      dominant_pollutant: dominantPollutant.toUpperCase(),
      pollutants: {
        unit: {
          pm2_5: "µg/m³",
          pm10: "µg/m³",
          no2: "µg/m³",
          so2: "µg/m³",
          o3: "µg/m³",
          co: "mg/m³",
        },
        values: pollutants,
      },
      sub_indices: subIndices,
      confidence: "medium",
      last_updated: new Date().toISOString(),
    };

    return res.json(response);
  } catch (err) {
    return res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
});

module.exports = router;