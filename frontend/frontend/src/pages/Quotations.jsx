
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Quotations.css";

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [role, setRole] = useState("");
  const [form, setForm] = useState({
    subscription_id: "",
    discount_code: "",
    tax: 0,
    valid_until: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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

      const quotationRes = await api.get(
        currentRole === "admin" || currentRole === "staff"
          ? "/quotations"
          : "/quotations/my"
      );

      setQuotations(
        quotationRes.data.quotations || quotationRes.data || []
      );

      if (currentRole === "admin" || currentRole === "staff") {
        const subRes = await api.get("/subscriptions");
        const allSubs = subRes.data.subscriptions || subRes.data || [];
        setSubscriptions(allSubs.filter((sub) => sub.status === "draft"));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load quotations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const { subscription_id, ...payload } = form;

      await api.post(`/quotations/${subscription_id}`, {
        ...payload,
        tax: Number(payload.tax),
        valid_until: payload.valid_until || null,
        discount_code: payload.discount_code.trim() || null,
      });

      setSuccess("Quotation created successfully!");
      setForm({
        subscription_id: "",
        discount_code: "",
        tax: 0,
        valid_until: "",
        notes: "",
      });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create quotation.");
    }
  };

  const handleSend = async (id) => {
    try {
      setError("");
      await api.patch(`/quotations/${id}/send`);
      setSuccess("Quotation sent successfully!");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send quotation.");
    }
  };

  const handleRespond = async (id, response) => {
    try {
      setError("");
      await api.patch(`/quotations/${id}/respond`, { response });
      setSuccess(`Quotation ${response} successfully!`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to respond.");
    }
  };

  const statusClass = (status) =>
    `quote-status quote-${String(status || "draft").toLowerCase()}`;

  if (loading) return <div className="quotes-loading">Loading quotations...</div>;

  return (
    <div className="quotes-page">
      <div className="quotes-header">
        <div>
          <span className="quotes-eyebrow">SUBSCRIPTION MANAGEMENT</span>
          <h1>Quotations</h1>
          <p>Create, send and manage customer quotations.</p>
        </div>

        {canManage && (
          <button
            className="quote-primary-btn"
            onClick={() => setShowForm(!showForm)}
          >
            + Create Quotation
          </button>
        )}
      </div>

      {error && <div className="quote-alert error">{error}</div>}
      {success && <div className="quote-alert success">{success}</div>}

      {showForm && canManage && (
        <form className="quote-form" onSubmit={handleCreate}>
          <h2>Create New Quotation</h2>

          <div className="quote-form-grid">
            <label>
              Draft Subscription
              <select
                value={form.subscription_id}
                onChange={(e) =>
                  setForm({ ...form, subscription_id: e.target.value })
                }
                required
              >
                <option value="">Select subscription</option>
                {subscriptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    #{sub.subscription_number || sub.id.slice(0, 8)} —{" "}
                    {sub.plans?.name || "Subscription"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Discount Code (optional)
              <input
                value={form.discount_code}
                onChange={(e) =>
                  setForm({ ...form, discount_code: e.target.value })
                }
                placeholder="e.g. SAVE10"
              />
            </label>

            <label>
              Tax Amount (₹)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tax}
                onChange={(e) =>
                  setForm({ ...form, tax: e.target.value })
                }
              />
            </label>

            <label>
              Valid Until
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) =>
                  setForm({ ...form, valid_until: e.target.value })
                }
              />
            </label>

            <label className="quote-notes">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
                placeholder="Additional details..."
                rows="3"
              />
            </label>
          </div>

          <div className="quote-form-actions">
            <button
              type="button"
              className="quote-secondary-btn"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button type="submit" className="quote-primary-btn">
              Create
            </button>
          </div>
        </form>
      )}

      <div className="quotes-stats">
        <div className="quote-stat-card">
          <span>Total Quotations</span>
          <strong>{quotations.length}</strong>
        </div>
        <div className="quote-stat-card">
          <span>Pending</span>
          <strong>
            {quotations.filter((q) => q.status === "sent").length}
          </strong>
        </div>
        <div className="quote-stat-card">
          <span>Accepted</span>
          <strong>
            {quotations.filter((q) => q.status === "accepted").length}
          </strong>
        </div>
      </div>

      <div className="quotes-table-card">
        <div className="quotes-table-heading">
          <div>
            <h2>{canManage ? "All Quotations" : "My Quotations"}</h2>
            <p>Review quotation details and status</p>
          </div>
          <span className="quotes-count">{quotations.length} records</span>
        </div>

        <div className="quotes-table-wrapper">
          <table className="quotes-table">
            <thead>
              <tr>
                <th>Quotation ID</th>
                <th>Subscription</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan="9" className="quotes-empty">
                    No quotations found.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q.id}>
                    <td><strong>#{q.quotation_number || q.id.slice(0, 8)}</strong></td>
                    <td>{q.subscription_id?.slice(0, 8) || "—"}</td>
                    <td>₹{Number(q.subtotal || 0).toLocaleString("en-IN")}</td>
                    <td>₹{Number(q.discount_amount || 0).toLocaleString("en-IN")}</td>
                    <td>₹{Number(q.tax_amount || 0).toLocaleString("en-IN")}</td>
                    <td className="quote-total">
                      ₹{Number(q.total_amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td>
                      <span className={statusClass(q.status)}>{q.status}</span>
                    </td>
                    <td>{q.valid_until || "—"}</td>
                    <td>
                      {canManage && q.status === "draft" && (
                        <button
                          className="quote-action-btn"
                          onClick={() => handleSend(q.id)}
                        >
                          Send
                        </button>
                      )}

                      {!canManage && q.status === "sent" && (
                        <div className="quote-response-actions">
                          <button
                            className="quote-accept-btn"
                            onClick={() => handleRespond(q.id, "accepted")}
                          >
                            Accept
                          </button>
                          <button
                            className="quote-reject-btn"
                            onClick={() => handleRespond(q.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {(!canManage || q.status !== "draft") &&
                        (canManage || q.status !== "sent") && "—"}
                    </td>
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
