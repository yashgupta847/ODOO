import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import "./Dashboard.css";
import { Link } from "react-router-dom";
const Dashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get("/auth/me");
        setProfile(data.profile);

        if (["admin", "staff"].includes(data.profile.role)) {
          const response = await api.get("/dashboard/summary");
          setSummary(response.data.summary);
        }
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) return <p>Loading dashboard...</p>;

  const menuItems = [
    "Dashboard",
    "Products",
    "Variants",
    "Plans",
    "Subscriptions",
    "Quotations",
    "Invoices",
    "Payments",
    "Discounts",
  ];

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <h2 className="brand">Brightloop</h2>

        <p className="menu-heading">MENU</p>

        <nav>
          {menuItems.map((item) => (
            <Link
              key={item}
              to={
                item === "Dashboard" ? "/dashboard" : `/${item.toLowerCase()}`
              }
              className={`menu-item ${item === "Dashboard" ? "active" : ""}`}
            >
              {item}
            </Link>
          ))}
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>Dashboard</h2>
            <p>Welcome back, {profile?.full_name || user?.email}</p>
          </div>

          <span className="role-badge">{profile?.role}</span>
        </header>

        {summary && (
          <>
            <h3 className="section-heading">Overview</h3>

            <div className="stats-grid">
              <StatCard
                title="Active Subscriptions"
                value={summary.active_subscriptions}
              />
              <StatCard title="Total Revenue" value={`₹${summary.revenue}`} />
              <StatCard title="Total Payments" value={summary.total_payments} />
              <StatCard
                title="Overdue Invoices"
                value={summary.overdue_invoices}
              />
              <StatCard
                title="Overdue Amount"
                value={`₹${summary.overdue_amount}`}
              />
            </div>
          </>
        )}

        {profile?.role === "customer" && (
          <div className="customer-welcome">
            <h3>Your Subscription Portal</h3>
            <p>Manage your subscriptions, quotations and invoices here.</p>
          </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ title, value }) => (
  <div className="stat-card">
    <p>{title}</p>
    <h2>{value ?? 0}</h2>
  </div>
);

export default Dashboard;
