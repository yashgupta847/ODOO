const express = require("express");
const cors = require("cors");
require("dotenv").config();

const supabase = require("./config/supabase");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Subscription Management API is running!" });
});

app.get("/test-db", async (req, res) => {
  const { data, error } = await supabase
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
});

app.listen(8080, () => {
  console.log("App is listening on port 8080");
});