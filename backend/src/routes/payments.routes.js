
const express = require("express");
const router = express.Router();

const { supabaseAdmin } = require("../config/supabase");
const verifyToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/authorizeRole");

// ADMIN / STAFF / CUSTOMER: Record payment against an invoice
router.post(
  "/:invoiceId",
  verifyToken,
  authorizeRole("admin", "staff", "customer"),
  async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { payment_method, amount, payment_date, note } = req.body;

      const validMethods = [
        "cash",
        "bank_transfer",
        "card",
        "upi",
        "other",
      ];

      if (
        !validMethods.includes(payment_method) ||
        amount === undefined ||
        amount === null ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
      ) {
        return res.status(400).json({
          message: "Invalid payment method or amount",
        });
      }

      // Fetch invoice
      const { data: invoice, error: invoiceError } =
        await supabaseAdmin
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

      if (invoiceError || !invoice) {
        return res.status(404).json({
          message: "Invoice not found",
        });
      }

      // Verify customer invoice ownership
      if (
        req.user.role === "customer" &&
        invoice.customer_id !== req.user.id
      ) {
        return res.status(403).json({
          message: "You are not allowed to pay this invoice",
        });
      }

      if (invoice.status !== "confirmed") {
        return res.status(400).json({
          message: "Only confirmed invoices can receive payments",
        });
      }

      // Fetch existing payments
      const { data: existingPayments, error: paymentsError } =
        await supabaseAdmin
          .from("payments")
          .select("amount")
          .eq("invoice_id", invoiceId);

      if (paymentsError) {
        return res.status(400).json({
          message: paymentsError.message,
        });
      }

      const alreadyPaid = existingPayments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );

      const paymentAmount = Number(amount);
      const remaining = Number(invoice.total_amount) - alreadyPaid;

      if (paymentAmount > remaining) {
        return res.status(400).json({
          message: `Payment exceeds remaining balance: ${remaining}`,
        });
      }

      // Record payment
      const { data: payment, error: paymentError } =
        await supabaseAdmin
          .from("payments")
          .insert({
            invoice_id: invoiceId,
            payment_method,
            amount: paymentAmount,
            payment_date: payment_date || new Date().toISOString(),
            note: note || null,
          })
          .select()
          .single();

      if (paymentError) {
        return res.status(400).json({
          message: paymentError.message,
        });
      }

      const totalPaid = alreadyPaid + paymentAmount;

      // Fully paid: mark invoice as paid
      if (totalPaid >= Number(invoice.total_amount)) {
        const { error: updateError } = await supabaseAdmin
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        if (updateError) {
          return res.status(400).json({
            message: updateError.message,
          });
        }

        // Activate related subscription
        const { error: subscriptionError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "active",
          })
          .eq("id", invoice.subscription_id)
          .eq("status", "confirmed");

        if (subscriptionError) {
          return res.status(400).json({
            message:
              "Payment received and invoice paid, but subscription activation failed",
          });
        }
      }

      return res.status(201).json({
        message: "Payment recorded successfully",
        payment,
        remaining_balance: Math.max(
          0,
          Number(invoice.total_amount) - totalPaid
        ),
        invoice_status:
          totalPaid >= Number(invoice.total_amount)
            ? "paid"
            : "confirmed",
      });
    } catch (error) {
      console.error("Payment error:", error);

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// ADMIN / STAFF: Get all payments
router.get(
  "/",
  verifyToken,
  authorizeRole("admin", "staff"),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false });

      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      return res.json(data);
    } catch (error) {
      console.error("Get payments error:", error);

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

// CUSTOMER: Get payments against own invoices
router.get("/my", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*, invoices!inner(customer_id, invoice_number)")
      .eq("invoices.customer_id", req.user.id)
      .order("payment_date", { ascending: false });

    if (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Get my payments error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;
