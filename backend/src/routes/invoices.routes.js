
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// ADMIN / STAFF: Generate invoice from accepted quotation
router.post(
  "/from-quotation/:quotationId",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { quotationId } = req.params;
      const { due_date } = req.body || {};

      // Validate due date
      if (!due_date || isNaN(Date.parse(due_date))) {
        return res.status(400).json({
          message: "A valid due_date is required",
        });
      }

      // Fetch accepted quotation
      const { data: quotation, error: quotationError } =
        await supabaseAdmin
          .from("quotations")
          .select("*")
          .eq("id", quotationId)
          .eq("status", "accepted")
          .single();

      if (quotationError) {
        console.error("QUOTATION FETCH ERROR:", quotationError);

        return res.status(404).json({
          message: quotationError.message,
        });
      }

      if (!quotation) {
        return res.status(404).json({
          message: "Accepted quotation not found",
        });
      }

      // Prevent duplicate invoice generation
      const { data: existingInvoice, error: existingError } =
        await supabaseAdmin
          .from("invoices")
          .select("id")
          .eq("subscription_id", quotation.subscription_id)
          .eq("customer_id", quotation.customer_id)
          .maybeSingle();

      if (existingError) {
        console.error("EXISTING INVOICE CHECK ERROR:", existingError);

        return res.status(400).json({
          message: existingError.message,
        });
      }

      if (existingInvoice) {
        return res.status(409).json({
          message: "An invoice already exists for this subscription",
        });
      }

      // Fetch subscription
      const { data: subscription, error: subError } =
        await supabaseAdmin
          .from("subscriptions")
          .select("*, plans(name)")
          .eq("id", quotation.subscription_id)
          .single();

      if (subError || !subscription) {
        console.error("SUBSCRIPTION FETCH ERROR:", subError);

        return res.status(404).json({
          message: subError?.message || "Related subscription not found",
        });
      }

      // Create invoice
      const { data: invoice, error: invoiceError } =
        await supabaseAdmin
          .from("invoices")
          .insert({
            subscription_id: quotation.subscription_id,
            customer_id: quotation.customer_id,
            subtotal: quotation.subtotal,
            discount_amount: quotation.discount_amount,
            tax_amount: quotation.tax_amount,
            total_amount: quotation.total_amount,
            status: "draft",
            issue_date: new Date().toISOString().split("T")[0],
            due_date,
          })
          .select()
          .single();

      if (invoiceError) {
        console.error("INVOICE INSERT ERROR:", invoiceError);

        return res.status(400).json({
          message: invoiceError.message,
        });
      }

      // Create invoice item
      const { error: itemError } = await supabaseAdmin
        .from("invoice_items")
        .insert({
          invoice_id: invoice.id,
          description: subscription.plans?.name || "Subscription plan",
          quantity: subscription.quantity,
          unit_price: subscription.unit_price,
          total_price:
            Number(subscription.quantity) *
            Number(subscription.unit_price),
        });

      if (itemError) {
        console.error("INVOICE ITEM INSERT ERROR:", itemError);

        // Rollback invoice if item creation fails
        const { error: rollbackError } = await supabaseAdmin
          .from("invoices")
          .delete()
          .eq("id", invoice.id);

        if (rollbackError) {
          console.error("INVOICE ROLLBACK ERROR:", rollbackError);
        }

        return res.status(400).json({
          message: itemError.message,
        });
      }

      return res.status(201).json({
        message: "Invoice created successfully",
        invoice,
      });
    } catch (error) {
      console.error("INVOICE GENERATION ERROR:", error);

      return res.status(500).json({
        message: error.message || "Server error",
      });
    }
  }
);

// ADMIN / STAFF: Get all invoices
router.get(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      return res.json(data);
    } catch (error) {
      console.error("GET INVOICES ERROR:", error);

      return res.status(500).json({
        message: error.message || "Server error",
      });
    }
  }
);

// CUSTOMER: Get own invoices
router.get("/my", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("customer_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    return res.json(data);
  } catch (error) {
    console.error("GET MY INVOICES ERROR:", error);

    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

// ADMIN / STAFF: Confirm draft invoice
router.patch(
  "/:id/confirm",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("invoices")
        .update({ status: "confirmed" })
        .eq("id", req.params.id)
        .eq("status", "draft")
        .select()
        .maybeSingle();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      if (!data) {
        return res.status(404).json({
          message: "Draft invoice not found",
        });
      }

      return res.json({
        message: "Invoice confirmed successfully",
        invoice: data,
      });
    } catch (error) {
      console.error("CONFIRM INVOICE ERROR:", error);

      return res.status(500).json({
        message: error.message || "Server error",
      });
    }
  }
);

// CUSTOMER: Accept or reject quotation
router.patch("/:id/respond", verifyToken, async (req, res) => {
  try {
    const { response } = req.body || {};

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
        .single();

    if (quotationError || !updatedQuotation) {
      return res.status(400).json({
        message:
          quotationError?.message || "Could not update quotation",
      });
    }

    // If accepted, confirm related subscription
    if (response === "accepted") {
      const { data: updatedSubscription, error: subError } =
        await supabaseAdmin
          .from("subscriptions")
          .update({ status: "confirmed" })
          .eq("id", quotation.subscription_id)
          .eq("customer_id", req.user.id)
          .eq("status", "quotation")
          .select()
          .maybeSingle();

      if (subError || !updatedSubscription) {
        console.error("SUBSCRIPTION CONFIRM ERROR:", subError);

        return res.status(400).json({
          message:
            "Quotation accepted, but subscription could not be confirmed",
        });
      }
    }

    return res.json({
      message: `Quotation ${response} successfully`,
      quotation: updatedQuotation,
    });
  } catch (error) {
    console.error("QUOTATION RESPONSE ERROR:", error);

    return res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

module.exports = router;
