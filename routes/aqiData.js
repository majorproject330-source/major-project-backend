const express = require("express");
const axios = require("axios");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
// calculateIndiaAQI (use only if wqai fails )
function calculateIndiaAQI(pm25) {
  if (pm25 == null || isNaN(pm25)) return null;

  const breakpoints = [
    { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
    { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
    { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
    { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
    { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
    { cLow: 251, cHigh: 500, iLow: 401, iHigh: 500 },
  ];

  const bp = breakpoints.find((b) => pm25 >= b.cLow && pm25 <= b.cHigh);

  if (!bp) return null;

  const aqi =
    ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow;

  return Math.round(aqi);
}

function getAQICategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}
router.get("/airQualityData",authMiddleware ,async (req, res) => {
  try {
    let location;
    // fetch location , if present in db use it else fetch from ip address
    if(req.query.city){
      location = req.query.city;
    }
    else{
    const userId = req.userId;
    const user = await User.findById(userId);
    location = user.location;
    if (location === "" || location === undefined) {
      const ipRes = await axios.get("https://ipapi.co/json/");
      location = ipRes.data.city;
    }
  }
    if (!location) {
      return res.status(400).json({
        message: "Unable to determine city",
      });
    }
    // location="Guntur";
    // fetching real AQI value from waqi API (it returns answer for major cities only , it is measured by sensors)
    let aqiValue = null;
    let dominantPollutant = null;
    let aqiSource = null;

    let waqiResult = await axios.get(
      `https://api.waqi.info/feed/${location}/`,
      {
        params: {
          token: process.env.WAQI_KEY,
        },
      },
    );

    if (
      waqiResult.data.status === "ok" &&
      typeof waqiResult.data.data.aqi === "number"
    ) {
      aqiValue = waqiResult.data.data.aqi;
      dominantPollutant = waqiResult.data.data.dominentpol;
      aqiSource = "sensor_measured (from waqi)";
    }
    // console.log(aqiValue, dominantPollutant, aqiSource);

    // fetching pollutants from openWeatherMap API
    const geoRes = await axios.get(
      "https://api.openweathermap.org/geo/1.0/direct",
      {
        params: {
          q: location,
          limit: 1,
          appid: process.env.OPENWEATHER_KEY,
        },
      },
    );

    if (!geoRes.data || geoRes.data.length === 0) {
      return res.status(400).json({
        message: "location not found in OpenWeather",
      });
    }

    const { lat, lon } = geoRes.data[0];

    // 3B: Fetch pollutant concentrations
    const airRes = await axios.get(
      "https://api.openweathermap.org/data/2.5/air_pollution",
      {
        params: {
          lat,
          lon,
          appid: process.env.OPENWEATHER_KEY,
        },
      },
    );

    const components = airRes.data.list[0].components;

    const pollutants = {
      pm2_5: components.pm2_5,
      pm10: components.pm10,
      no2: components.no2,
      co: components.co,
      o3: components.o3,
      so2: components.so2,
    };

    // console.log(pollutants);
    // ================================ only if waqi is fail =======================================
    if (aqiValue === null) {
      aqiValue = calculateIndiaAQI(pollutants.pm2_5);
      dominantPollutant = "PM2.5";
      aqiSource = "model_estimated (from formula)";
    }

    // =================================================================================================

    const aqiCategory = getAQICategory(aqiValue);

    const responseObject = {
      location: location,
      aqi: {
        value: aqiValue,
        category: aqiCategory,
        source: aqiSource,
      },
      dominant_pollutant: dominantPollutant
        ? dominantPollutant.toUpperCase()
        : "PM2.5",
      pollutants: {
        unit: "µg/m³",
        values: {
          pm2_5: pollutants.pm2_5,
          pm10: pollutants.pm10,
          no2: pollutants.no2,
          co: pollutants.co,
          o3: pollutants.o3,
          so2: pollutants.so2,
        },
      },
      pollutant_source: "model_estimated (openWeatherMap API)",
      confidence: aqiSource === "sensor_measured" ? "high" : "medium",

      last_updated: new Date().toISOString(),
    };

    return res.json(responseObject);
  } catch (error) {
    return res.status(500).json({
      status: "Error",
      message: error.message,
    });
  }
});

module.exports = router;
