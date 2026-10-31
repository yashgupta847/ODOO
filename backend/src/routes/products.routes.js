
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// GET all active products
router.get("/", verifyToken, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("is_active", true);

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  res.json({ products: data });
});

// CREATE product
router.post(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { name, product_type, sale_price, cost_price, notes } = req.body;

      if (!name || !product_type || sale_price == null || cost_price == null) {
        return res.status(400).json({
          message: "Required fields are missing",
        });
      }

      if (
        !Number.isFinite(Number(sale_price)) ||
        !Number.isFinite(Number(cost_price)) ||
        Number(sale_price) < 0 ||
        Number(cost_price) < 0
      ) {
        return res.status(400).json({
          message: "Prices must be valid non-negative numbers",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("products")
        .insert([{
          name,
          product_type,
          sale_price,
          cost_price,
          notes,
        }])
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.status(201).json({
        message: "Product created successfully",
        product: data,
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// UPDATE product
router.patch(
  "/:id",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    const allowedFields = [
      "name",
      "product_type",
      "sale_price",
      "cost_price",
      "notes",
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
      ("sale_price" in updates &&
        (!Number.isFinite(Number(updates.sale_price)) || Number(updates.sale_price) < 0)) ||
      ("cost_price" in updates &&
        (!Number.isFinite(Number(updates.cost_price)) || Number(updates.cost_price) < 0))
    ) {
      return res.status(400).json({
        message: "Prices must be valid non-negative numbers",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({
      message: "Product updated successfully",
      product: data,
    });
  }
);

// DEACTIVATE product (soft delete)
router.patch(
  "/:id/deactivate",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("products")
      .update({ is_active: false })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({
      message: "Product deactivated successfully",
      product: data,
    });
  }
);

module.exports = router;
