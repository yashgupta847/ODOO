import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Discounts.css";

const initialForm = {
  name: "",
  code: "",
  discount_type: "percentage",
  discount_value: "",
  minimum_purchase: "",
  minimum_quantity: 1,
  applies_to: "subscription",
  product_id: "",
  plan_id: "",
  start_date: "",
  end_date: "",
  usage_limit: "",
};

export default function Discounts() {
  const [discounts, setDiscounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [role, setRole] = useState("");
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManage = ["admin", "staff"].includes(role);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      //   const userRes = await api.get("/auth/me");
      const userRes = await api.get("/auth/me");
      const currentRole = userRes.data.profile?.role || "";
      setRole(currentRole);
      console.log("USER ROLE:", currentRole);

      const isManager = ["admin", "staff"].includes(currentRole);

      const discountRes = await api.get(
        isManager ? "/discounts" : "/discounts/available",
      );
      console.log("DISCOUNTS RESPONSE:", discountRes.data);

      setDiscounts(discountRes.data.discounts || discountRes.data || []);
      if (["admin", "staff"].includes(currentRole)) {
        const [productRes, planRes] = await Promise.all([
          api.get("/products"),
          api.get("/plans"),
        ]);

        setProducts(productRes.data.products || productRes.data || []);
        setPlans(planRes.data.plans || planRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load discounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        discount_value: Number(form.discount_value),
        minimum_purchase: form.minimum_purchase
          ? Number(form.minimum_purchase)
          : 0,
        minimum_quantity: Number(form.minimum_quantity || 1),
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        product_id: form.applies_to === "product" ? form.product_id : null,
        plan_id: form.applies_to === "subscription" ? form.plan_id : null,
      };

      await api.post("/discounts", payload);

      setSuccess("Discount created successfully!");
      setForm(initialForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create discount.");
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this discount?")) {
      return;
    }

    try {
      await api.patch(`/discounts/${id}/deactivate`);
      setSuccess("Discount deactivated successfully!");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate discount.");
    }
  };

  if (loading) {
    return <div className="discount-loading">Loading discounts...</div>;
  }

  return (
    <div className="discounts-page">
      <div className="discounts-header">
        <div>
          <span className="discount-eyebrow">SUBSCRIPTION MANAGEMENT</span>
          <h1>Discounts</h1>
          <p>Manage promotional offers and discount campaigns.</p>
        </div>

        {canManage && (
          <button
            className="discount-primary-btn"
            onClick={() => setShowForm(!showForm)}
          >
            + Create Discount
          </button>
        )}
      </div>

      {error && <div className="discount-alert error">{error}</div>}
      {success && <div className="discount-alert success">{success}</div>}

      {showForm && canManage && (
        <form className="discount-form" onSubmit={handleSubmit}>
          <h2>Create New Discount</h2>

          <div className="discount-form-grid">
            <label>
              Discount Name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Summer Sale"
                required
              />
            </label>

            <label>
              Discount Code
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="SUMMER20"
                required
              />
            </label>

            <label>
              Discount Type
              <select
                name="discount_type"
                value={form.discount_type}
                onChange={handleChange}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </label>

            <label>
              Discount Value
              <input
                type="number"
                name="discount_value"
                min="0.01"
                step="0.01"
                value={form.discount_value}
                onChange={handleChange}
                placeholder="20"
                required
              />
            </label>

            <label>
              Minimum Purchase (₹)
              <input
                type="number"
                name="minimum_purchase"
                min="0"
                value={form.minimum_purchase}
                onChange={handleChange}
                placeholder="0"
              />
            </label>

            <label>
              Minimum Quantity
              <input
                type="number"
                name="minimum_quantity"
                min="1"
                value={form.minimum_quantity}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Applies To
              <select
                name="applies_to"
                value={form.applies_to}
                onChange={handleChange}
              >
                <option value="subscription">Subscription Plan</option>
                <option value="product">Product</option>
              </select>
            </label>

            {form.applies_to === "product" ? (
              <label>
                Select Product
                <select
                  name="product_id"
                  value={form.product_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Select Plan
                <select
                  name="plan_id"
                  value={form.plan_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Choose plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Start Date
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              End Date
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Usage Limit
              <input
                type="number"
                name="usage_limit"
                min="1"
                value={form.usage_limit}
                onChange={handleChange}
                placeholder="Unlimited if empty"
              />
            </label>
          </div>

          <div className="discount-form-actions">
            <button
              type="button"
              className="discount-secondary-btn"
              onClick={() => {
                setShowForm(false);
                setForm(initialForm);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="discount-primary-btn">
              Create Discount
            </button>
          </div>
        </form>
      )}

      <div className="discount-table-card">
        <div className="discount-table-heading">
          <div>
            <h2>{canManage ? "All Discounts" : "Available Discounts"}</h2>
            <p>Discount codes and their current usage details.</p>
          </div>
          <span className="discount-count">{discounts.length} records</span>
        </div>

        <div className="discount-table-wrapper">
          <table className="discount-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Discount</th>
                <th>Applies To</th>
                <th>Validity</th>
                <th>Usage</th>
                {canManage && <th>Status</th>}
                {canManage && <th>Action</th>}
              </tr>
            </thead>

            <tbody>
              {discounts.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 6} className="discount-empty">
                    No discounts found.
                  </td>
                </tr>
              ) : (
                discounts.map((discount) => (
                  <tr key={discount.id}>
                    <td>
                      <strong>{discount.name}</strong>
                    </td>
                    <td>
                      <span className="discount-code">{discount.code}</span>
                    </td>
                    <td>
                      {discount.discount_type === "percentage"
                        ? `${discount.discount_value}%`
                        : `₹${discount.discount_value}`}
                    </td>
                    <td>{discount.applies_to}</td>
                    <td>
                      {discount.start_date || "—"} to {discount.end_date || "—"}
                    </td>
                    <td>
                      {discount.usage_count || 0} /{" "}
                      {discount.usage_limit ?? "∞"}
                    </td>
                    {canManage && (
                      <td>
                        <span
                          className={`discount-status ${discount.is_active ? "active" : "inactive"}`}
                        >
                          {discount.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    )}
                    {canManage && (
                      <td>
                        {discount.is_active && (
                          <button
                            className="discount-deactivate-btn"
                            onClick={() => handleDeactivate(discount.id)}
                          >
                            Deactivate
                          </button>
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
