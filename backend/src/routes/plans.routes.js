
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// GET all plans
router.get("/", verifyToken, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("*");

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  res.json({ plans: data });
});

// CREATE plan
router.post(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const {
        product_id,
        name,
        billing_frequency,
        price,
        min_quantity,
        availability_start,
        availability_end,
        auto_close,
        allow_early_close,
        allow_pause,
        allow_renew
      } = req.body;

      if (!product_id || !name || !billing_frequency || price == null) {
        return res.status(400).json({
          message: "Required fields are missing",
        });
      }

      const frequencies = ["daily", "weekly", "monthly", "yearly"];

      if (!frequencies.includes(billing_frequency)) {
        return res.status(400).json({
          message: "Invalid billing frequency",
        });
      }

      if (!Number.isFinite(Number(price)) || Number(price) < 0) {
        return res.status(400).json({
          message: "Invalid plan price",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("plans")
        .insert([{
          product_id,
          name,
          billing_frequency,
          price,
          min_quantity: min_quantity ?? 1,
          availability_start,
          availability_end,
          auto_close: auto_close ?? false,
          allow_early_close: allow_early_close ?? true,
          allow_pause: allow_pause ?? true,
          allow_renew: allow_renew ?? true
        }])
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.status(201).json({
        message: "Plan created successfully",
        plan: data,
      });

    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// UPDATE plan
router.patch(
  "/:id",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    const allowedFields = [
      "name",
      "billing_frequency",
      "price",
      "min_quantity",
      "availability_start",
      "availability_end",
      "auto_close",
      "allow_early_close",
      "allow_pause",
      "allow_renew"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided",
      });
    }

    if (
      updates.price !== undefined &&
      (!Number.isFinite(Number(updates.price)) || Number(updates.price) < 0)
    ) {
      return res.status(400).json({
        message: "Invalid plan price",
      });
    }

    if (
      updates.billing_frequency !== undefined &&
      !["daily", "weekly", "monthly", "yearly"].includes(updates.billing_frequency)
    ) {
      return res.status(400).json({
        message: "Invalid billing frequency",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("plans")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({
      message: "Plan updated successfully",
      plan: data,
    });
  }
);

module.exports = router;
