
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// ADMIN / STAFF: Create discount
router.post(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const {
        name,
        code,
        discount_type,
        discount_value,
        minimum_purchase,
        minimum_quantity,
        applies_to,
        product_id,
        plan_id,
        start_date,
        end_date,
        usage_limit,
      } = req.body;

      if (
        !name ||
        !code ||
        !["fixed", "percentage"].includes(discount_type) ||
        !["product", "subscription"].includes(applies_to) ||
        !Number.isFinite(Number(discount_value)) ||
        Number(discount_value) <= 0
      ) {
        return res.status(400).json({
          message: "Invalid discount details",
        });
      }

      if (
        discount_type === "percentage" &&
        Number(discount_value) > 100
      ) {
        return res.status(400).json({
          message: "Percentage discount cannot exceed 100",
        });
      }

      if (
        applies_to === "product" && !product_id
      ) {
        return res.status(400).json({
          message: "Product is required for product discount",
        });
      }

      if (
        applies_to === "subscription" && !plan_id
      ) {
        return res.status(400).json({
          message: "Plan is required for subscription discount",
        });
      }

      const { data, error } = await supabaseAdmin
        .from("discounts")
        .insert({
          name,
          code: code.trim().toUpperCase(),
          discount_type,
          discount_value: Number(discount_value),
          minimum_purchase: minimum_purchase ?? 0,
          minimum_quantity: minimum_quantity ?? 1,
          applies_to,
          product_id: product_id || null,
          plan_id: plan_id || null,
          start_date: start_date || null,
          end_date: end_date || null,
          usage_limit: usage_limit || null,
          usage_count: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return res.status(201).json({
        message: "Discount created successfully",
        discount: data,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// ADMIN / STAFF: Get all discounts
router.get(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("discounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return res.json(data);
    } catch (error) {
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// CUSTOMER: Get currently available discounts
router.get("/available", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("discounts")
      .select("*")
      .eq("is_active", true);

    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    const availableDiscounts = data.filter((discount) => {
      return (
        discount.usage_limit === null ||
        discount.usage_count < discount.usage_limit
      );
    });

    return res.json(availableDiscounts);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
});

// ADMIN / STAFF: Update discount
router.patch(
  "/:id",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const allowedFields = [
        "name",
        "discount_value",
        "minimum_purchase",
        "minimum_quantity",
        "start_date",
        "end_date",
        "usage_limit",
        "is_active",
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

      if (updates.discount_value !== undefined) {
        const value = Number(updates.discount_value);

        if (!Number.isFinite(value) || value <= 0) {
          return res.status(400).json({
            message: "Invalid discount value",
          });
        }

        updates.discount_value = value;
      }

      const { data, error } = await supabaseAdmin
        .from("discounts")
        .update(updates)
        .eq("id", req.params.id)
        .select()
        .maybeSingle();

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message: "Discount not found",
        });
      }

      return res.json({
        message: "Discount updated successfully",
        discount: data,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// ADMIN / STAFF: Deactivate discount
router.patch(
  "/:id/deactivate",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("discounts")
        .update({ is_active: false })
        .eq("id", req.params.id)
        .select()
        .maybeSingle();

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          message: "Discount not found",
        });
      }

      return res.json({
        message: "Discount deactivated successfully",
        discount: data,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

module.exports = router;
