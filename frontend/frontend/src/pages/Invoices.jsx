
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Invoices.css";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [role, setRole] = useState("");
  const [selectedQuotation, setSelectedQuotation] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

      const invoiceRes = await api.get(
        currentRole === "admin" || currentRole === "staff"
          ? "/invoices"
          : "/invoices/my"
      );

      setInvoices(invoiceRes.data.invoices || invoiceRes.data || []);

      if (currentRole === "admin" || currentRole === "staff") {
        const quotationRes = await api.get("/quotations");
        const allQuotations =
          quotationRes.data.quotations || quotationRes.data || [];

        setQuotations(
          allQuotations.filter((q) => q.status === "accepted")
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createInvoice = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedQuotation) {
      setError("Please select an accepted quotation.");
      return;
    }

    if (!dueDate) {
      setError("Please select an invoice due date.");
      return;
    }

    if (dueDate < new Date().toISOString().split("T")[0]) {
      setError("Due date cannot be in the past.");
      return;
    }

    try {
      setCreating(true);

      await api.post(`/invoices/from-quotation/${selectedQuotation}`, {
        due_date: dueDate,
      });

      setSuccess("Invoice generated successfully!");
      setSelectedQuotation("");
      setDueDate("");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to generate invoice.");
    } finally {
      setCreating(false);
    }
  };

  const confirmInvoice = async (id) => {
    try {
      setError("");
      setSuccess("");

      await api.patch(`/invoices/${id}/confirm`);

      setSuccess("Invoice confirmed successfully!");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to confirm invoice.");
    }
  };

  const statusClass = (status) =>
    `invoice-status invoice-${String(status || "draft").toLowerCase()}`;

  if (loading) {
    return <div className="invoices-loading">Loading invoices...</div>;
  }

  return (
    <div className="invoices-page">
      <div className="invoices-header">
        <div>
          <span className="invoices-eyebrow">SUBSCRIPTION MANAGEMENT</span>
          <h1>Invoices</h1>
          <p>Manage billing, invoices and customer payments.</p>
        </div>

        <div className="invoice-total-card">
          <span>Total Invoices</span>
          <strong>{invoices.length}</strong>
        </div>
      </div>

      {error && <div className="invoice-alert error">{error}</div>}
      {success && <div className="invoice-alert success">{success}</div>}

      {canManage && (
        <form className="invoice-create-card" onSubmit={createInvoice}>
          <div>
            <h2>Generate Invoice</h2>
            <p>Create an invoice from an accepted quotation.</p>
          </div>

          <div className="invoice-create-form">
            <select
              value={selectedQuotation}
              onChange={(e) => setSelectedQuotation(e.target.value)}
              required
            >
              <option value="">Select accepted quotation</option>

              {quotations.map((q) => (
                <option key={q.id} value={q.id}>
                  Quotation #{q.quotation_number || q.id.slice(0, 8)}
                  {" — "}₹{Number(q.total_amount).toLocaleString("en-IN")}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dueDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />

            <button
              type="submit"
              className="invoice-primary-btn"
              disabled={creating}
            >
              {creating ? "Generating..." : "Generate Invoice"}
            </button>
          </div>
        </form>
      )}

      <div className="invoice-stats">
        <div className="invoice-stat-card">
          <span>Total Invoices</span>
          <strong>{invoices.length}</strong>
        </div>

        <div className="invoice-stat-card">
          <span>Confirmed</span>
          <strong>
            {invoices.filter((i) => i.status === "confirmed").length}
          </strong>
        </div>

        <div className="invoice-stat-card">
          <span>Paid</span>
          <strong>
            {invoices.filter((i) => i.status === "paid").length}
          </strong>
        </div>
      </div>

      <div className="invoice-table-card">
        <div className="invoice-table-heading">
          <div>
            <h2>{canManage ? "All Invoices" : "My Invoices"}</h2>
            <p>Invoice details and payment status</p>
          </div>

          <span className="invoice-count">{invoices.length} records</span>
        </div>

        <div className="invoice-table-wrapper">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Subtotal</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Status</th>
                {canManage && <th>Action</th>}
              </tr>
            </thead>

            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 8 : 7}
                    className="invoice-empty"
                  >
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>
                        #{invoice.invoice_number || invoice.id.slice(0, 8)}
                      </strong>
                    </td>

                    <td>{invoice.issue_date || "—"}</td>
                    <td>{invoice.due_date || "—"}</td>

                    <td>
                      ₹{Number(invoice.subtotal || 0).toLocaleString("en-IN")}
                    </td>

                    <td>
                      ₹{Number(invoice.tax_amount || 0).toLocaleString("en-IN")}
                    </td>

                    <td className="invoice-price">
                      ₹{Number(invoice.total_amount || 0).toLocaleString("en-IN")}
                    </td>

                    <td>
                      <span className={statusClass(invoice.status)}>
                        {invoice.status}
                      </span>
                    </td>

                    {canManage && (
                      <td>
                        {invoice.status === "draft" ? (
                          <button
                            className="invoice-confirm-btn"
                            onClick={() => confirmInvoice(invoice.id)}
                          >
                            Confirm
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
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
