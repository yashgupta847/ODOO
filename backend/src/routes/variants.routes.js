
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// GET variants of a product
router.get("/:productId", verifyToken, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("product_variants")
    .select("*")
    .eq("product_id", req.params.productId);

  if (error) {
    return res.status(500).json({ message: error.message });
  }

  res.json({ variants: data });
});

// CREATE variant
router.post(
  "/:productId",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { name, additional_price } = req.body;

      if (!name || additional_price == null ||
          !Number.isFinite(Number(additional_price)) ||
          Number(additional_price) < 0) {
        return res.status(400).json({
          message: "Valid name and additional price are required",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("product_variants")
        .insert([{
          product_id: req.params.productId,
          name,
          additional_price,
        }])
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.status(201).json({
        message: "Variant created successfully",
        variant: data,
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// DELETE variant
router.delete(
  "/:variantId",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    const { error } = await supabaseAdmin
      .from("product_variants")
      .delete()
      .eq("id", req.params.variantId);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({ message: "Variant deleted successfully" });
  }
);

module.exports = router;
