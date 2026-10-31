
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { supabaseAdmin } = require("./src/config/supabase");
const authRoutes = require("./src/routes/auth.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Subscription Management API is running!",
  });
});
app.get("/test-db", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("connection_test")
      .select("*");

    if (error) {
      return res.status(500).json({
        message: "Supabase request failed",
        error: error.message,
      });
    }

    res.json({
      message: "Supabase API is working!",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});
