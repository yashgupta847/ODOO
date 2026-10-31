
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// ADMIN / STAFF: Dashboard summary
router.get(
  "/summary",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      // Validate date filters
      if (
        (start_date && isNaN(Date.parse(start_date))) ||
        (end_date && isNaN(Date.parse(end_date)))
      ) {
        return res.status(400).json({
          message: "Invalid date format",
        });
      }

      if (start_date && end_date && start_date > end_date) {
        return res.status(400).json({
          message: "Start date cannot be after end date",
        });
      }

      // Call PostgreSQL function
      const { data, error } = await supabaseAdmin.rpc(
        "get_dashboard_summary",
        {
          p_start_date: start_date || null,
          p_end_date: end_date || null,
        }
      );

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return res.json({
        message: "Dashboard summary fetched successfully",
        summary: data,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

module.exports = router;
