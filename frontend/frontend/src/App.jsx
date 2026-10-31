import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./routes/ProtectedRoute";
import Products from "./pages/Products";
import Variants from "./pages/Variants";
import Plans from "./pages/Plans";
import Subscriptions from "./pages/Subscriptions";
import Quotations from "./pages/Quotations";
import Invoices from "./pages/Invoices";
import Payments from "./pages/Payments";
import Discounts from "./pages/Discounts";
function App() {
  return (
    <Routes>
      <Route path="/payments" element={<Payments />} />
      <Route path="/invoices" element={<Invoices />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/discounts" element={<Discounts />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="/subscriptions" element={<Subscriptions />} />
      <Route path="/products" element={<Products />} />
      <Route path="/plans" element={<Plans />} />
      <Route path="/quotations" element={<Quotations />} />
      <Route path="/variants" element={<Variants />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
