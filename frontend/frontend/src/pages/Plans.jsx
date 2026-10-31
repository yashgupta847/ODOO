
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Plans.css";

const initialForm = {
  product_id: "",
  name: "",
  billing_frequency: "monthly",
  price: "",
  min_quantity: 1,
  availability_start: "",
  availability_end: "",
  auto_close: false,
  allow_early_close: true,
  allow_pause: true,
  allow_renew: true,
};

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [role, setRole] = useState("");
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canManage = role === "admin" || role === "staff";

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, productsRes, userRes] = await Promise.all([
        api.get("/plans"),
        api.get("/products"),
        api.get("/auth/me"),
      ]);

      setPlans(plansRes.data.plans || plansRes.data);
      setProducts(productsRes.data.products || productsRes.data);
      setRole(userRes.data.profile?.role || "");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load plans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEdit = (plan) => {
    setEditingId(plan.id);
    setForm({
      product_id: plan.product_id || "",
      name: plan.name || "",
      billing_frequency: plan.billing_frequency || "monthly",
      price: plan.price ?? "",
      min_quantity: plan.min_quantity ?? 1,
      availability_start: plan.availability_start || "",
      availability_end: plan.availability_end || "",
      auto_close: plan.auto_close ?? false,
      allow_early_close: plan.allow_early_close ?? true,
      allow_pause: plan.allow_pause ?? true,
      allow_renew: plan.allow_renew ?? true,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        min_quantity: Number(form.min_quantity),
        availability_start: form.availability_start || null,
        availability_end: form.availability_end || null,
      };

      if (editingId) {
        await api.patch(`/plans/${editingId}`, payload);
      } else {
        await api.post("/plans", payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save plan.");
    }
  };

  if (loading) return <div className="plans-loading">Loading plans...</div>;

  return (
    <div className="plans-page">
      <div className="plans-header">
        <div>
          <span className="plans-eyebrow">SUBSCRIPTION MANAGEMENT</span>
          <h1>Plans</h1>
          <p>Manage your subscription plans and pricing.</p>
        </div>

        {canManage && (
          <button
            className="plan-primary-btn"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            + Create Plan
          </button>
        )}
      </div>

      {error && <div className="plans-error">{error}</div>}

      <div className="plans-stats">
        <div className="plan-stat-card">
          <span>Total Plans</span>
          <strong>{plans.length}</strong>
        </div>
        <div className="plan-stat-card">
          <span>Available Products</span>
          <strong>{products.length}</strong>
        </div>
        <div className="plan-stat-card">
          <span>Billing Types</span>
          <strong>4</strong>
        </div>
      </div>

      {showForm && canManage && (
        <form className="plan-form" onSubmit={handleSubmit}>
          <div className="plan-form-heading">
            <h2>{editingId ? "Edit Plan" : "Create New Plan"}</h2>
            <button type="button" className="plan-close" onClick={resetForm}>
              ✕
            </button>
          </div>

          <div className="plan-form-grid">
            <label>
              Product
              <select
                name="product_id"
                value={form.product_id}
                onChange={handleChange}
                required
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Plan Name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Premium Monthly"
                required
              />
            </label>

            <label>
              Billing Frequency
              <select
                name="billing_frequency"
                value={form.billing_frequency}
                onChange={handleChange}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            <label>
              Price (₹)
              <input
                type="number"
                name="price"
                min="0"
                step="0.01"
                value={form.price}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Minimum Quantity
              <input
                type="number"
                name="min_quantity"
                min="1"
                value={form.min_quantity}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Availability Start
              <input
                type="date"
                name="availability_start"
                value={form.availability_start}
                onChange={handleChange}
              />
            </label>

            <label>
              Availability End
              <input
                type="date"
                name="availability_end"
                value={form.availability_end}
                onChange={handleChange}
              />
            </label>
          </div>

          <div className="plan-options">
            {[
              ["auto_close", "Automatically close plan"],
              ["allow_early_close", "Allow early closure"],
              ["allow_pause", "Allow pause"],
              ["allow_renew", "Allow renewal"],
            ].map(([key, label]) => (
              <label className="plan-checkbox" key={key}>
                <input
                  type="checkbox"
                  name={key}
                  checked={form[key]}
                  onChange={handleChange}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="plan-form-actions">
            <button type="button" className="plan-secondary-btn" onClick={resetForm}>
              Cancel
            </button>
            <button type="submit" className="plan-primary-btn">
              {editingId ? "Update Plan" : "Save Plan"}
            </button>
          </div>
        </form>
      )}

      <div className="plans-table-card">
        <div className="plans-table-heading">
          <div>
            <h2>All Plans</h2>
            <p>Subscription pricing and billing details</p>
          </div>
          <span className="plans-count">{plans.length} plans</span>
        </div>

        <div className="plans-table-wrapper">
          <table className="plans-table">
            <thead>
              <tr>
                <th>Plan Name</th>
                <th>Product</th>
                <th>Billing</th>
                <th>Price</th>
                <th>Min. Qty</th>
                {canManage && <th>Action</th>}
              </tr>
            </thead>

            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="plans-empty">
                    No plans available yet.
                  </td>
                </tr>
              ) : (
                plans.map((plan) => {
                  const product = products.find(
                    (p) => p.id === plan.product_id
                  );

                  return (
                    <tr key={plan.id}>
                      <td>
                        <strong>{plan.name}</strong>
                      </td>
                      <td>{product?.name || "—"}</td>
                      <td>
                        <span className="billing-badge">
                          {plan.billing_frequency}
                        </span>
                      </td>
                      <td className="plan-price">
                        ₹{Number(plan.price).toLocaleString("en-IN")}
                      </td>
                      <td>{plan.min_quantity}</td>
                      {canManage && (
                        <td>
                          <button
                            className="plan-edit-btn"
                            onClick={() => handleEdit(plan)}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
