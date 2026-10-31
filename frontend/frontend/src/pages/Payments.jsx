
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Payments.css";

const initialForm = {
  invoice_id: "",
  payment_method: "upi",
  amount: "",
  note: "",
};

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [role, setRole] = useState("");
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManage = role === "admin" || role === "staff";

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const userRes = await api.get("/auth/me");
      const currentRole = userRes.data.profile?.role || "";
      setRole(currentRole);

      const paymentRes = await api.get(
        currentRole === "admin" || currentRole === "staff"
          ? "/payments"
          : "/payments/my"
      );

      const allPayments =
        paymentRes.data.payments || paymentRes.data || [];

      setPayments(allPayments);

      const invoiceRes = await api.get(
        currentRole === "admin" || currentRole === "staff"
          ? "/invoices"
          : "/invoices/my"
      );

      const allInvoices =
        invoiceRes.data.invoices || invoiceRes.data || [];

      setInvoices(
        allInvoices.filter((invoice) => invoice.status === "confirmed")
      );
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getOutstandingAmount = (invoice) => {
    const alreadyPaid = payments
      .filter((payment) => payment.invoice_id === invoice.id)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return Math.max(
      0,
      Number(invoice.total_amount || 0) - alreadyPaid
    );
  };

  const handleInvoiceChange = (invoiceId) => {
    const selectedInvoice = invoices.find(
      (invoice) => invoice.id === invoiceId
    );

    setForm({
      ...form,
      invoice_id: invoiceId,
      amount: selectedInvoice
        ? getOutstandingAmount(selectedInvoice).toFixed(2)
        : "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.invoice_id) {
      setError("Please select an invoice.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    try {
      setSaving(true);

      const { invoice_id, ...payload } = form;

      await api.post(`/payments/${invoice_id}`, {
        ...payload,
        amount: Number(payload.amount),
      });

      setSuccess("Payment recorded successfully!");
      setForm(initialForm);
      setShowForm(false);

      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to record payment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="payments-loading">Loading payments...</div>;
  }

  const totalRevenue = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  return (
    <div className="payments-page">
      <div className="payments-header">
        <div>
          <span className="payments-eyebrow">SUBSCRIPTION MANAGEMENT</span>
          <h1>Payments</h1>
          <p>Track customer payments and transaction records.</p>
        </div>

        {(canManage || invoices.length > 0) && (
          <button
            className="payment-primary-btn"
            onClick={() => {
              setShowForm(!showForm);
              setError("");
              setSuccess("");
            }}
          >
            {canManage ? "+ Record Payment" : "Pay Invoice"}
          </button>
        )}
      </div>

      {error && <div className="payment-alert error">{error}</div>}
      {success && <div className="payment-alert success">{success}</div>}

      <div className="payment-stats">
        <div className="payment-stat-card">
          <span>Total Transactions</span>
          <strong>{payments.length}</strong>
        </div>

        <div className="payment-stat-card">
          <span>Total Payments</span>
          <strong>₹{totalRevenue.toLocaleString("en-IN")}</strong>
        </div>

        <div className="payment-stat-card">
          <span>Payment Methods</span>
          <strong>
            {new Set(payments.map((p) => p.payment_method)).size}
          </strong>
        </div>
      </div>

      {showForm && (
        <form className="payment-form" onSubmit={handleSubmit}>
          <h2>{canManage ? "Record New Payment" : "Pay Your Invoice"}</h2>

          <div className="payment-form-grid">
            <label>
              Select Invoice
              <select
                value={form.invoice_id}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                required
              >
                <option value="">Choose invoice</option>

                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    Invoice #{invoice.invoice_number || invoice.id.slice(0, 8)}
                    {" — "}₹
                    {getOutstandingAmount(invoice).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                    {" due"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Payment Method
              <select
                value={form.payment_method}
                onChange={(e) =>
                  setForm({ ...form, payment_method: e.target.value })
                }
              >
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Amount (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={
                  invoices.find((i) => i.id === form.invoice_id)
                    ? getOutstandingAmount(
                        invoices.find((i) => i.id === form.invoice_id)
                      )
                    : undefined
                }
                value={form.amount}
                onChange={(e) =>
                  setForm({ ...form, amount: e.target.value })
                }
                placeholder="Enter amount"
                required
              />
            </label>

            <label>
              Note (optional)
              <input
                value={form.note}
                onChange={(e) =>
                  setForm({ ...form, note: e.target.value })
                }
                placeholder="Transaction reference or note"
              />
            </label>
          </div>

          {form.invoice_id && (
            <p>
              Outstanding amount: ₹
              {getOutstandingAmount(
                invoices.find((i) => i.id === form.invoice_id)
              ).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </p>
          )}

          <div className="payment-form-actions">
            <button
              type="button"
              className="payment-secondary-btn"
              onClick={() => {
                setShowForm(false);
                setForm(initialForm);
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="payment-primary-btn"
              disabled={saving}
            >
              {saving ? "Processing..." : "Save Payment"}
            </button>
          </div>
        </form>
      )}

      <div className="payment-table-card">
        <div className="payment-table-heading">
          <div>
            <h2>{canManage ? "All Payments" : "My Payments"}</h2>
            <p>Payment history and transaction details</p>
          </div>

          <span className="payment-count">{payments.length} records</span>
        </div>

        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Invoice ID</th>
                <th>Payment Method</th>
                <th>Amount</th>
                <th>Payment Date</th>
                <th>Note</th>
              </tr>
            </thead>

            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="payment-empty">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>#{payment.id.slice(0, 8)}</strong>
                    </td>

                    <td>{payment.invoice_id?.slice(0, 8) || "—"}</td>

                    <td>
                      <span className="payment-method">
                        {payment.payment_method?.replace("_", " ")}
                      </span>
                    </td>

                    <td className="payment-amount">
                      ₹{Number(payment.amount).toLocaleString("en-IN")}
                    </td>

                    <td>
                      {payment.payment_date
                        ? new Date(payment.payment_date).toLocaleDateString("en-IN")
                        : "—"}
                    </td>

                    <td>{payment.note || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
