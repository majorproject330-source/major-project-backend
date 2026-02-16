require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db.js");

const app = express();
connectDB()


app.use(express.json());
app.use(cors());
app.get("/",(req,res)=>{
  res.send("Backend is running ");
});

app.use("/api/auth",require("./routes/auth"));
app.use("/api",require("./routes/aqiData"));
app.use("/api",require("./routes/llm"));
app.use("/api", require("./routes/weatherRoutes"));
app.use("/api",require("./routes/trafficRoutes"));













const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});