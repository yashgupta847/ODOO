import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Variants.css";
const Variants = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [variants, setVariants] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    additional_price: "",
  });

  const canManage = ["admin", "staff"].includes(profile?.role);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productRes, profileRes] = await Promise.all([
          api.get("/products"),
          api.get("/auth/me"),
        ]);

        setProducts(productRes.data.products || productRes.data);
        setProfile(profileRes.data.profile);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load data");
      }
    };

    loadData();
  }, []);

  const fetchVariants = async (productId) => {
    try {
      const { data } = await api.get(`/variants/${productId}`);
      setVariants(data.variants || data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch variants");
    }
  };

  const handleProductChange = (e) => {
    const productId = e.target.value;
    setSelectedProduct(productId);
    setVariants([]);
    setError("");

    if (productId) fetchVariants(productId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post(`/variants/${selectedProduct}`, {
        name: form.name,
        additional_price: Number(form.additional_price),
      });

      setForm({ name: "", additional_price: "" });
      await fetchVariants(selectedProduct);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add variant");
    }
  };

  const handleDelete = async (variantId) => {
    try {
      await api.delete(`/variants/${variantId}`);
      await fetchVariants(selectedProduct);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete variant");
    }
  };

  return (
    <div className="variants-page">
      <div className="variants-header">
        <div>
          <span className="variants-eyebrow">PRODUCT MANAGEMENT</span>
          <h1>Product Variants</h1>
          <p>Manage additional options and pricing for products.</p>
        </div>
      </div>

      {error && <div className="variants-alert error">{error}</div>}

      <div className="variants-form-card">
        <label className="variants-select-label">Select Product</label>
        <select
          className="variants-product-select"
          value={selectedProduct}
          onChange={handleProductChange}
        >
          <option value="">Choose a product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <>
          {canManage && (
            <div className="variants-form-card">
              <h2>Add Variant</h2>
              <p>Add an additional option and its extra price.</p>

              <form className="variants-form" onSubmit={handleSubmit}>
                <label>
                  Variant Name
                  <input
                    placeholder="e.g. Large"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </label>

                <label>
                  Additional Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 100"
                    value={form.additional_price}
                    onChange={(e) =>
                      setForm({ ...form, additional_price: e.target.value })
                    }
                    required
                  />
                </label>

                <button className="variants-primary-btn" type="submit">
                  Add Variant
                </button>
              </form>
            </div>
          )}

          <div className="variants-table-card">
            <div className="variants-table-heading">
              <div>
                <h2>Available Variants</h2>
                <p>All available options for this product.</p>
              </div>
              <span className="variants-count">{variants.length} Variants</span>
            </div>

            <div className="variants-table-wrapper">
              <table className="variants-table">
                <thead>
                  <tr>
                    <th>Variant Name</th>
                    <th>Additional Price</th>
                    {canManage && <th>Action</th>}
                  </tr>
                </thead>

                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id}>
                      <td>
                        <strong>{variant.name}</strong>
                      </td>
                      <td className="variants-price">
                        ₹{variant.additional_price}
                      </td>
                      {canManage && (
                        <td>
                          <button
                            className="variants-delete-btn"
                            onClick={() => handleDelete(variant.id)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}

                  {variants.length === 0 && (
                    <tr>
                      <td
                        colSpan={canManage ? 3 : 2}
                        className="variants-empty"
                      >
                        No variants available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Variants;
