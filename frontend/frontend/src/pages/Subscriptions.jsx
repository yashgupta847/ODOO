
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Subscriptions.css";

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [role, setRole] = useState("");

  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [pricing, setPricing] = useState(null);

  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canManage = ["admin", "staff"].includes(role);

  const selectedPlan = plans.find((plan) => plan.id === planId);

  const subtotal = selectedPlan
    ? Number(selectedPlan.price) * Number(quantity)
    : 0;

  const clearCoupon = () => {
    setCouponCode("");
    setAppliedCoupon("");
    setPricing(null);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const userRes = await api.get("/auth/me");
      const currentRole = userRes.data.profile?.role || "";
      setRole(currentRole);

      const [planRes, subRes] = await Promise.all([
        api.get("/plans"),
        api.get(
          ["admin", "staff"].includes(currentRole)
            ? "/subscriptions"
            : "/subscriptions/my"
        ),
      ]);

      setPlans(planRes.data.plans || planRes.data || []);
      setSubscriptions(subRes.data.subscriptions || subRes.data || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to load subscriptions."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const applyCoupon = async () => {
    if (!selectedPlan) {
      setError("Please select a plan first.");
      return;
    }

    if (!couponCode.trim()) {
      setError("Please enter a coupon code.");
      return;
    }

    try {
      setApplying(true);
      setError("");
      setSuccess("");

      const res = await api.post("/subscriptions/preview-discount", {
        plan_id: planId,
        quantity: Number(quantity),
        coupon_code: couponCode.trim().toUpperCase(),
      });

      setPricing(res.data.pricing);
      setAppliedCoupon(couponCode.trim().toUpperCase());
      setSuccess("Coupon applied successfully!");
    } catch (err) {
      setPricing(null);
      setAppliedCoupon("");
      setError(
        err.response?.data?.message || "Unable to apply coupon."
      );
    } finally {
      setApplying(false);
    }
  };

  const createSubscription = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/subscriptions", {
        plan_id: planId,
        quantity: Number(quantity),
        coupon_code: appliedCoupon || null,
      });

      setSuccess(
        `Subscription created! Final amount: ₹${res.data.pricing.totalAmount}`
      );

      setPlanId("");
      setQuantity(1);
      clearCoupon();

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to create subscription."
      );
    }
  };

  // Pause, resume or cancel a subscription
  const handleLifecycleAction = async (id, action) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${action} this subscription?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`${id}-${action}`);
      setError("");
      setSuccess("");

      const res = await api.patch(`/subscriptions/${id}/${action}`);

      setSuccess(
        res.data.message || `Subscription ${action} successful!`
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Unable to ${action} subscription.`
      );
    } finally {
      setActionLoading("");
    }
  };

  const getStatusClass = (status) => `sub-status status-${status}`;

  const renderLifecycleActions = (sub) => {
    const { id, status } = sub;

    if (status === "closed") return "—";

    return (
      <div className="subs-actions">
        {status === "active" && (
          <button
            className="subs-action-btn pause-btn"
            disabled={!!actionLoading}
            onClick={() => handleLifecycleAction(id, "pause")}
          >
            {actionLoading === `${id}-pause` ? "Pausing..." : "Pause"}
          </button>
        )}

        {status === "paused" && (
          <button
            className="subs-action-btn resume-btn"
            disabled={!!actionLoading}
            onClick={() => handleLifecycleAction(id, "resume")}
          >
            {actionLoading === `${id}-resume` ? "Resuming..." : "Resume"}
          </button>
        )}

        {["draft", "quotation", "confirmed", "active", "paused"].includes(
          status
        ) && (
          <button
            className="subs-action-btn cancel-btn"
            disabled={!!actionLoading}
            onClick={() => handleLifecycleAction(id, "cancel")}
          >
            {actionLoading === `${id}-cancel` ? "Cancelling..." : "Cancel"}
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="subs-loading">Loading subscriptions...</div>;
  }

  return (
    <div className="subs-page">
      <div className="subs-header">
        <div>
          <span className="subs-eyebrow">SUBSCRIPTION MANAGEMENT</span>
          <h1>Subscriptions</h1>
          <p>Track and manage your subscription lifecycle.</p>
        </div>

        <div className="subs-total">
          <span>Total Subscriptions</span>
          <strong>{subscriptions.length}</strong>
        </div>
      </div>

      {error && <div className="subs-alert error">{error}</div>}
      {success && <div className="subs-alert success">{success}</div>}

      {!canManage && (
        <form className="subs-create-card" onSubmit={createSubscription}>
          <div>
            <h2>Start a Subscription</h2>
            <p>Choose a plan, quantity and optional coupon.</p>
          </div>

          <div className="subs-form-grid">
            <label>
              Select Plan
              <select
                value={planId}
                onChange={(e) => {
                  setPlanId(e.target.value);
                  clearCoupon();
                }}
                required
              >
                <option value="">Choose a plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — ₹{plan.price}/{plan.billing_frequency}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min={selectedPlan?.min_quantity || 1}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  clearCoupon();
                }}
                required
              />
            </label>

            <label>
              Coupon Code
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  setAppliedCoupon("");
                  setPricing(null);
                }}
                placeholder="Enter coupon code"
              />
            </label>

            <button
              type="button"
              className="subs-secondary-btn"
              onClick={applyCoupon}
              disabled={applying}
            >
              {applying ? "Applying..." : "Apply Coupon"}
            </button>
          </div>

          {selectedPlan && (
            <div className="subs-pricing">
              <div>
                <span>Subtotal</span>
                <strong>₹{subtotal.toFixed(2)}</strong>
              </div>

              {pricing && (
                <>
                  <div>
                    <span>Coupon ({appliedCoupon})</span>
                    <strong className="subs-discount">
                      - ₹{Number(pricing.discount).toFixed(2)}
                    </strong>
                  </div>

                  <div className="subs-final-price">
                    <span>Final Amount</span>
                    <strong>
                      ₹{Number(pricing.totalAmount).toFixed(2)}
                    </strong>
                  </div>
                </>
              )}

              {!pricing && (
                <div className="subs-final-price">
                  <span>Estimated Amount</span>
                  <strong>₹{subtotal.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}

          <button
            className="subs-primary-btn"
            type="submit"
            disabled={!planId}
          >
            Create Subscription
          </button>
        </form>
      )}

      <div className="subs-table-card">
        <div className="subs-table-heading">
          <div>
            <h2>{canManage ? "All Subscriptions" : "My Subscriptions"}</h2>
            <p>Subscription details and current status</p>
          </div>

          <span className="subs-count">
            {subscriptions.length} records
          </span>
        </div>

        <div className="subs-table-wrapper">
          <table className="subs-table">
            <thead>
              <tr>
                <th>Subscription ID</th>
                <th>Plan</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Total Amount</th>
                <th>Start Date</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 9 : 8}
                    className="subs-empty"
                  >
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <strong>
                        #{sub.subscription_number || sub.id.slice(0, 8)}
                      </strong>
                    </td>

                    <td>{sub.plans?.name || sub.plan_name || "—"}</td>
                    <td>{sub.quantity}</td>

                    <td className="subs-price">
                      ₹{Number(sub.unit_price).toLocaleString("en-IN")}
                    </td>

                    <td>
                      {sub.discount_code || "—"}
                      {Number(sub.discount_amount) > 0 && (
                        <div className="subs-discount">
                          -₹{Number(sub.discount_amount).toFixed(2)}
                        </div>
                      )}
                    </td>

                    <td className="subs-price">
                      ₹
                      {Number(
                        sub.total_amount ??
                          Number(sub.unit_price) * Number(sub.quantity)
                      ).toLocaleString("en-IN")}
                    </td>

                    <td>
                      {sub.start_date
                        ? new Date(sub.start_date).toLocaleDateString("en-IN")
                        : "—"}
                    </td>

                    <td>
                      <span className={getStatusClass(sub.status)}>
                        {sub.status}
                      </span>
                    </td>

                    {canManage && (
                      <td>{renderLifecycleActions(sub)}</td>
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
