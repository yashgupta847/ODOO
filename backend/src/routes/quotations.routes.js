
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// ADMIN / STAFF: Create quotation from subscription

router.post(
  "/:subscriptionId",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const { discount_code, tax = 0, valid_until, notes } = req.body;

      // Fetch subscription
      const { data: subscription, error: subError } = await supabaseAdmin
        .from("subscriptions")
        .select("*, plans(product_id)")
        .eq("id", subscriptionId)
        .single();

      if (subError || !subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      if (subscription.status !== "draft") {
        return res.status(400).json({
          message: "Quotation can only be created for draft subscriptions",
        });
      }

      const subtotal =
        Number(subscription.unit_price) * Number(subscription.quantity);

      const taxAmount = Number(tax);

      if (!Number.isFinite(taxAmount) || taxAmount < 0) {
        return res.status(400).json({ message: "Invalid tax amount" });
      }

      let discountAmount = 0;
      let appliedDiscount = null;

      // Apply discount code if provided
      if (discount_code) {
        const code = discount_code.trim().toUpperCase();

        const { data: discount, error: discountError } =
          await supabaseAdmin
            .from("discounts")
            .select("*")
            .eq("code", code)
            .eq("is_active", true)
            .maybeSingle();

        if (discountError || !discount) {
          return res.status(400).json({
            message: "Invalid or inactive discount code",
          });
        }

        const today = new Date().toISOString().split("T")[0];

        if (
          (discount.start_date && today < discount.start_date) ||
          (discount.end_date && today > discount.end_date)
        ) {
          return res.status(400).json({
            message: "Discount code is outside its validity period",
          });
        }

        if (
          discount.usage_limit !== null &&
          discount.usage_count >= discount.usage_limit
        ) {
          return res.status(400).json({
            message: "Discount usage limit reached",
          });
        }

        if (
          subtotal < Number(discount.minimum_purchase || 0) ||
          subscription.quantity < Number(discount.minimum_quantity || 1)
        ) {
          return res.status(400).json({
            message: "Minimum purchase or quantity requirement not met",
          });
        }

        const productId = subscription.plans?.product_id;
        const appliesTo = discount.applies_to;

        if (
          (appliesTo === "product" && discount.product_id !== productId) ||
          (appliesTo === "subscription" &&
            discount.plan_id !== subscription.plan_id)
        ) {
          return res.status(400).json({
            message: "Discount does not apply to this subscription",
          });
        }

        if (!["product", "subscription"].includes(appliesTo)) {
          return res.status(400).json({
            message: "Invalid discount configuration",
          });
        }

        if (discount.discount_type === "percentage") {
          if (
            Number(discount.discount_value) <= 0 ||
            Number(discount.discount_value) > 100
          ) {
            return res.status(400).json({
              message: "Invalid percentage discount configuration",
            });
          }

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
        appliedDiscount = discount;
      }

      discountAmount = Number(discountAmount.toFixed(2));

      const total = Number(
        (subtotal - discountAmount + taxAmount).toFixed(2)
      );

      // Create quotation
      const { data: quotation, error: quotationError } =
        await supabaseAdmin
          .from("quotations")
          .insert({
            subscription_id: subscription.id,
            customer_id: subscription.customer_id,
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            total_amount: total,
            status: "draft",
            valid_until: valid_until || null,
            notes: notes || null,
          })
          .select()
          .single();

      if (quotationError) {
        return res.status(400).json({
          message: quotationError.message,
        });
      }

      // Increment discount usage count
      if (appliedDiscount) {
        const { error: usageError } = await supabaseAdmin
          .from("discounts")
          .update({
            usage_count: (appliedDiscount.usage_count || 0) + 1,
          })
          .eq("id", appliedDiscount.id);

        if (usageError) {
          return res.status(400).json({
            message: "Quotation created, but discount usage update failed",
          });
        }
      }

      return res.status(201).json({
        message: "Quotation created successfully",
        quotation,
        applied_discount: appliedDiscount
          ? {
              code: appliedDiscount.code,
              discount_amount: discountAmount,
            }
          : null,
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error" });
    }
  }
);


// ADMIN / STAFF: Get all quotations
router.get(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("quotations")
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

// CUSTOMER: Get own quotations
router.get("/my", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("quotations")
      .select("*")
      .eq("customer_id", req.user.id)
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
});

// ADMIN / STAFF: Send quotation
router.patch(
  "/:id/send",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      // Find draft quotation
      const { data: quotation, error: fetchError } =
        await supabaseAdmin
          .from("quotations")
          .select("*")
          .eq("id", req.params.id)
          .eq("status", "draft")
          .single();

      if (fetchError || !quotation) {
        return res.status(404).json({
          message: "Draft quotation not found",
        });
      }

      // Update quotation status
      const { data: updatedQuotation, error: quotationError } =
        await supabaseAdmin
          .from("quotations")
          .update({ status: "sent" })
          .eq("id", quotation.id)
          .eq("status", "draft")
          .select()
          .maybeSingle();

      if (quotationError || !updatedQuotation) {
        return res.status(400).json({
          message: quotationError?.message || "Could not send quotation",
        });
      }

      // Update subscription status
      const { data: updatedSubscription, error: subscriptionError } =
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "quotation" })
          .eq("id", quotation.subscription_id)
          .eq("status", "draft")
          .select()
          .maybeSingle();

      if (subscriptionError || !updatedSubscription) {
        return res.status(400).json({
          message: "Quotation sent, but subscription status could not be updated",
        });
      }

      return res.json({
        message: "Quotation sent successfully",
        quotation: updatedQuotation,
        subscription: updatedSubscription,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// CUSTOMER: Accept or reject quotation
router.patch(
  "/:id/respond",
  verifyToken,
  authorizeRole("customer"),
  async (req, res) => {
    try {
      const { response } = req.body;

      if (!["accepted", "rejected"].includes(response)) {
        return res.status(400).json({
          message: "Response must be accepted or rejected",
        });
      }

      // Find quotation belonging to this customer
      const { data: quotation, error: fetchError } =
        await supabaseAdmin
          .from("quotations")
          .select("*")
          .eq("id", req.params.id)
          .eq("customer_id", req.user.id)
          .eq("status", "sent")
          .single();

      if (fetchError || !quotation) {
        return res.status(404).json({
          message: "Sent quotation not found",
        });
      }

      // Update quotation status
      const { data: updatedQuotation, error: quotationError } =
        await supabaseAdmin
          .from("quotations")
          .update({ status: response })
          .eq("id", quotation.id)
          .eq("status", "sent")
          .select()
          .maybeSingle();

      if (quotationError || !updatedQuotation) {
        return res.status(400).json({
          message: quotationError?.message || "Could not update quotation",
        });
      }

      // If accepted, confirm subscription
      if (response === "accepted") {
        const { data: updatedSubscription, error: subscriptionError } =
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "confirmed" })
            .eq("id", quotation.subscription_id)
            .eq("customer_id", req.user.id)
            .eq("status", "quotation")
            .select()
            .maybeSingle();

        if (subscriptionError || !updatedSubscription) {
          return res.status(400).json({
            message: "Quotation accepted, but subscription confirmation failed",
          });
        }
      }

      return res.json({
        message: `Quotation ${response} successfully`,
        quotation: updatedQuotation,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

module.exports = router;
