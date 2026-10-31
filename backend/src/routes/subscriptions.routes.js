
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// CUSTOMER: Create subscription
// CUSTOMER: Create subscription with optional coupon
router.post("/", verifyToken, async (req, res) => {
  try {
    const { plan_id, quantity, coupon_code } = req.body;

    if (!plan_id || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Valid plan_id and quantity are required",
      });
    }

    // Fetch plan
    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    if (quantity < plan.min_quantity) {
      return res.status(400).json({
        message: `Minimum quantity is ${plan.min_quantity}`,
      });
    }

    const today = new Date().toISOString().split("T")[0];

    if (plan.availability_start && today < plan.availability_start) {
      return res.status(400).json({
        message: "Plan is not available yet",
      });
    }

    if (plan.availability_end && today > plan.availability_end) {
      return res.status(400).json({
        message: "Plan availability has expired",
      });
    }

    const subtotal = Number(plan.price) * quantity;

    let discount = 0;
    let discountId = null;
    let discountCode = null;

    // Validate coupon if provided
    if (coupon_code?.trim()) {
      const normalizedCode = coupon_code.trim().toUpperCase();

      const { data: coupon, error: couponError } = await supabaseAdmin
        .from("discounts")
        .select("*")
        .eq("code", normalizedCode)
        .eq("is_active", true)
        .maybeSingle();

      if (couponError || !coupon) {
        return res.status(400).json({
          message: "Invalid or inactive coupon code",
        });
      }

      if (
        (coupon.start_date && today < coupon.start_date) ||
        (coupon.end_date && today > coupon.end_date)
      ) {
        return res.status(400).json({
          message: "Coupon is not currently valid",
        });
      }

      if (
        coupon.usage_limit !== null &&
        coupon.usage_count >= coupon.usage_limit
      ) {
        return res.status(400).json({
          message: "Coupon usage limit reached",
        });
      }

      if (coupon.applies_to !== "subscription" || coupon.plan_id !== plan_id) {
        return res.status(400).json({
          message: "Coupon is not applicable to this plan",
        });
      }

      if (quantity < Number(coupon.minimum_quantity || 1)) {
        return res.status(400).json({
          message: `Minimum quantity for this coupon is ${coupon.minimum_quantity}`,
        });
      }

      if (subtotal < Number(coupon.minimum_purchase || 0)) {
        return res.status(400).json({
          message: `Minimum purchase amount is ₹${coupon.minimum_purchase}`,
        });
      }

      discount =
        coupon.discount_type === "percentage"
          ? (subtotal * Number(coupon.discount_value)) / 100
          : Number(coupon.discount_value);

      discount = Math.min(discount, subtotal);
      discount = Number(discount.toFixed(2));

      discountId = coupon.id;
      discountCode = coupon.code;
    }

    const totalAmount = Number((subtotal - discount).toFixed(2));

    // Create subscription
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .insert([{
        customer_id: req.user.id,
        plan_id,
        quantity,
        unit_price: plan.price,
        discount_id: discountId,
        discount_code: discountCode,
        discount_amount: discount,
        total_amount: totalAmount,
        status: "draft",
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Increment coupon usage after successful subscription creation
    if (discountId) {
      const { error: usageError } = await supabaseAdmin
        .from("discounts")
        .update({
          usage_count: (await supabaseAdmin
            .from("discounts")
            .select("usage_count")
            .eq("id", discountId)
            .single()).data.usage_count + 1,
        })
        .eq("id", discountId);

      if (usageError) {
        console.error("Coupon usage update failed:", usageError.message);
      }
    }

    return res.status(201).json({
      message: "Subscription created successfully",
      subscription: data,
      pricing: {
        subtotal,
        discount,
        totalAmount,
      },
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});
const updateLifecycleStatus = (allowedCurrentStatuses, nextStatus) => {
  return async (req, res) => {
    try {
      const { id } = req.params;

      // Fetch existing subscription
      const { data: existing, error: fetchError } =
        await supabaseAdmin
          .from("subscriptions")
          .select("id, status")
          .eq("id", id)
          .maybeSingle();

      if (fetchError) {
        return res.status(500).json({
          message: fetchError.message,
        });
      }

      if (!existing) {
        return res.status(404).json({
          message: "Subscription not found",
        });
      }

      // Validate current status
      if (!allowedCurrentStatuses.includes(existing.status)) {
        return res.status(400).json({
          message: `Cannot change subscription from ${existing.status} to ${nextStatus}`,
        });
      }

      // Update status
      const { data, error } = await supabaseAdmin
        .from("subscriptions")
        .update({ status: nextStatus })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return res.json({
        message: `Subscription ${nextStatus === "closed" ? "cancelled" : nextStatus} successfully`,
        subscription: data,
      });

    } catch (error) {
      console.error("Lifecycle update error:", error);

      return res.status(500).json({
        message: "Internal server error",
      });
    }
  };
};


// PAUSE: Active -> Paused
router.patch(
  "/:id/pause",
  verifyToken,
  authorizeRole("admin", "staff"),
  updateLifecycleStatus(["active"], "paused")
);


// RESUME: Paused -> Active
router.patch(
  "/:id/resume",
  verifyToken,
  authorizeRole("admin", "staff"),
  updateLifecycleStatus(["paused"], "active")
);


// CANCEL: Draft / Quotation / Confirmed / Active / Paused -> Closed
router.patch(
  "/:id/cancel",
  verifyToken,
  authorizeRole("admin", "staff"),
  updateLifecycleStatus(
    ["draft", "quotation", "confirmed", "active", "paused"],
    "closed"
  )
);


router.post("/preview-discount", verifyToken, async (req, res) => {
  try {
    const { plan_id, quantity, coupon_code } = req.body;
    if (!plan_id || !quantity || !coupon_code?.trim()) {
      return res.status(400).json({
        message: "Plan, quantity and coupon code are required",
      });
    }
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({
        message: "Invalid quantity",
      });
    }

    // 1. Fetch selected plan
    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      return res.status(404).json({
        message: "Plan not found",
      });
    }

    if (qty < Number(plan.min_quantity || 1)) {
      return res.status(400).json({
        message: `Minimum quantity for this plan is ${plan.min_quantity}`,
      });
    }

    // 2. Fetch coupon
    const { data: discount, error: discountError } =
      await supabaseAdmin
        .from("discounts")
        .select("*")
        .ilike("code", coupon_code.trim())
        .eq("is_active", true)
        .maybeSingle();

    if (discountError || !discount) {
      return res.status(404).json({
        message: "Invalid or inactive coupon",
      });
    }

    // 3. Validate coupon applicability
    if (discount.applies_to !== "subscription") {
      return res.status(400).json({
        message: "This coupon is not applicable to subscriptions",
      });
    }

    if (discount.plan_id && discount.plan_id !== plan_id) {
      return res.status(400).json({
        message: "This coupon is not applicable to the selected plan",
      });
    }

    if (qty < Number(discount.minimum_quantity || 1)) {
      return res.status(400).json({
        message: `Minimum quantity required is ${discount.minimum_quantity}`,
      });
    }

    // 4. Check usage limit
    if (
      discount.usage_limit !== null &&
      discount.usage_limit !== undefined &&
      Number(discount.usage_count || 0) >= Number(discount.usage_limit)
    ) {
      return res.status(400).json({
        message: "Coupon usage limit has been reached",
      });
    }

    // 5. Calculate pricing
    const subtotal = Number(plan.price) * qty;

    if (subtotal < Number(discount.minimum_purchase || 0)) {
      return res.status(400).json({
        message: `Minimum purchase amount is ${discount.minimum_purchase}`,
      });
    }

    let discountAmount = 0;

    if (discount.discount_type === "percentage") {
      discountAmount =
        (subtotal * Number(discount.discount_value)) / 100;
    } else if (discount.discount_type === "fixed") {
      discountAmount = Number(discount.discount_value);
    } else {
      return res.status(400).json({
        message: "Invalid discount type",
      });
    }

    discountAmount = Math.min(discountAmount, subtotal);

    const totalAmount = Math.max(0, subtotal - discountAmount);

    return res.status(200).json({
      message: "Coupon applied successfully",
      pricing: {
        subtotal,
        discount: discountAmount,
        totalAmount,
        discountCode: discount.code,
      },
    });
  } catch (error) {
    console.error("Preview discount error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// CUSTOMER: Get own subscriptions
router.get("/my", verifyToken, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*, plans(name, billing_frequency, price)")
    .eq("customer_id", req.user.id);

  if (error) {
    return res.status(500).json({
      message: error.message,
    });
  }

  res.json({ subscriptions: data });
});

// ADMIN / STAFF: Get all subscriptions
router.get(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*, plans(name, billing_frequency, price)");

    if (error) {
      return res.status(500).json({
        message: error.message,
      });
    }

    res.json({ subscriptions: data });
  }
);

// ADMIN / STAFF: Update subscription status
router.patch(
  "/:id/status",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    const { status } = req.body;

    const allowedStatuses = [
      "draft",
      "quotation",
      "confirmed",
      "active",
      "closed",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid subscription status",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    res.json({
      message: "Subscription status updated",
      subscription: data,
    });
  }
);

module.exports = router;
