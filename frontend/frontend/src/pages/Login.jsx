
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" >
      <div className="login-left">
        <div className="login-brand">
          <div className="brand-icon">B</div>
          <span>Brightloop</span>
        </div>

        <div className="login-hero">
          <span className="hero-tag">SUBSCRIPTION MANAGEMENT</span>
          <h1>Manage your business subscriptions smarter.</h1>
          <p>
            One platform to manage customers, plans, invoices and payments.
            Everything your business needs, in one place.
          </p>

          <div className="hero-features">
            <div><span>✓</span> Simplified subscription management</div>
            <div><span>✓</span> Real-time payment tracking</div>
            <div><span>✓</span> Complete business overview</div>
          </div>
        </div>

        <div className="login-footer">
          © 2026 Brightloop Software. All rights reserved.
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-mobile-brand">
            <div className="brand-icon">B</div>
            <span>Brightloop</span>
          </div>

          <span className="login-welcome">WELCOME BACK</span>
          <h2>Sign in to your account</h2>
          <p className="login-subtitle">
            Enter your details to access your dashboard.
          </p>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />

            <div className="password-label">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <div className="password-input">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="login-register">
            Don't have an account?
            <Link to="/register"> Create account</Link>
          </div>

          <div className="login-security">
            <span>🔒</span> Your account information is secure.
          </div>
        </div>
      </div>
    </div>
  );
}
