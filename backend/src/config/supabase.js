const path = require("path");

// Load backend/.env explicitly
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const { createClient } = require("@supabase/supabase-js");

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

module.exports = { supabaseAuth, supabaseAdmin };