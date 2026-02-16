const express = require("express");
const Groq = require("groq-sdk");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* ================================
   Reusable LLM Function
================================ */
async function generateLLMResponse(prompt, maxTokens = 150, temperature = 0.5) {
  
  try {
    const chat_completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: temperature,
      max_tokens: maxTokens,
    });

    return chat_completion.choices[0]?.message?.content?.trim();
  } catch (error) {
    console.error("LLM Error:", error);
    throw new Error("LLM generation failed");
  }
}

/* ================================
   Air Quality Explanation Route
================================ */
router.post("/explainAirQuality", authMiddleware, async (req, res) => {
  try {
    const { location, aqi, dominant_pollutant } = req.body;

    const aqiValue = aqi?.value || aqi || "N/A";
    const aqiCategory = aqi?.category || "N/A";

    const prompt = `
Location: ${location}
AQI: ${aqiValue}
Category: ${aqiCategory}
Dominant Pollutant: ${dominant_pollutant}

In exactly 2 short paragraphs:
Paragraph 1: Give a very simple explanation of the air quality.
Paragraph 2: Give one clear precaution people should take.

Use simple everyday language.
Do not use bullet points.
Do not add extra lines.
`;

    const explanation = await generateLLMResponse(prompt, 120, 0.5);

    if (explanation) {
      return res.json({ explanation });
    }

    res.json({ explanation: "AI could not generate a response." });

  } catch (err) {
    console.error("Route Error:", err);
    res.status(500).json({ explanation: "Server failure." });
  }
});

/* =====================================================
   2️⃣ POST WEATHER EXPLANATION (LLM)
===================================================== */
router.post("/weather/explain", authMiddleware, async (req, res) => {
  try {
    const {
      city,
      temperature,
      feels_like,
      humidity,
      pressure,
      wind_speed,
      description
    } = req.body;

    if (!city) {
      return res.status(400).json({ message: "Weather data missing" });
    }

    const prompt = `
You are a weather assistant.

Based on the following data:

City: ${city}
Temperature: ${temperature}°C
Feels Like: ${feels_like}°C
Humidity: ${humidity}%
Pressure: ${pressure} hPa
Wind Speed: ${wind_speed} m/s
Condition: ${description}

Respond in very simple language.

Write exactly TWO short paragraphs:

First paragraph:
Explain what this weather means in simple terms.

Second paragraph:
Give general health precautions and daily advice.

Do NOT use bullet points.
Do NOT use numbering.
Do NOT use headings.
Do NOT format text.
Just plain paragraphs.
Keep it short and natural.
`;

    const explanation = await generateLLMResponse(prompt, 180, 0.4);

    res.json({ explanation });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "LLM explanation failed" });
  }
});

/* =====================================================
  3  LLM TRAFFIC EXPLANATION
===================================================== */
router.post("/trafficExplain", authMiddleware, async (req, res) => {
  try {
    const {
      city,
      current_speed,
      normal_speed,
      delay,
      congestion
    } = req.body;

    const prompt = `
You are a traffic assistant.

Traffic in ${city}:
Current speed: ${current_speed} km/h
Normal speed: ${normal_speed} km/h
Delay: ${delay} seconds
Congestion: ${congestion}

Write exactly THREE short lines describing the traffic condition.

Then write ONE short paragraph giving travel precautions.

No headings.
No bullet points.
Keep it simple.
`;

    const explanation = await generateLLMResponse(prompt, 150, 0.4);

    res.json({ explanation });

  } catch (err) {
    res.status(500).json({ message: "LLM failed" });
  }
});

module.exports = router;


