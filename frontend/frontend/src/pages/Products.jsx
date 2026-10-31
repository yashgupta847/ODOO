
import { useEffect, useState } from "react";
import api from "../api/axios";
import "./Product.css";

const Products = () => {
  const [products, setProducts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const initialForm = {
    name: "",
    product_type: "",
    sale_price: "",
    cost_price: "",
    notes: "",
  };

  const [form, setForm] = useState(initialForm);

  const canManage = ["admin", "staff"].includes(profile?.role);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get("/products");
      setProducts(data.products || data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch products");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data } = await api.get("/auth/me");
        setProfile(data.profile);
        await fetchProducts();
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load products");
      }
    };

    loadData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (editingId) {
        await api.patch(`/products/${editingId}`, form);
      } else {
        await api.post("/products", form);
      }

      setForm(initialForm);
      setEditingId(null);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save product");
    }
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name || "",
      product_type: product.product_type || "",
      sale_price: product.sale_price ?? "",
      cost_price: product.cost_price ?? "",
      notes: product.notes || "",
    });
  };

  const handleDeactivate = async (id) => {
    try {
      await api.patch(`/products/${id}/deactivate`);
      await fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to deactivate product");
    }
  };

  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <h1>Products</h1>
          <p>Manage your software products and their pricing.</p>
        </div>
      </div>

      {error && <p className="products-error">{error}</p>}

      {canManage && (
        <form className="product-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Edit Product" : "Add Product"}</h3>

          <input
            name="name"
            placeholder="Product Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <input
            name="product_type"
            placeholder="Product Type"
            value={form.product_type}
            onChange={handleChange}
            required
          />

          <input
            name="sale_price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Sales Price"
            value={form.sale_price}
            onChange={handleChange}
            required
          />

          <input
            name="cost_price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Cost Price"
            value={form.cost_price}
            onChange={handleChange}
            required
          />

          <textarea
            name="notes"
            placeholder="Product Notes"
            value={form.notes}
            onChange={handleChange}
          />

          <button type="submit">
            {editingId ? "Update Product" : "Add Product"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(initialForm);
              }}
            >
              Cancel
            </button>
          )}
        </form>
      )}

      <h3 className="product-list-heading">Product List</h3>

      <div className="products-table-wrapper">
        <table className="products-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Sales Price</th>
              <th>Cost Price</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.product_type}</td>
                <td>₹{product.sale_price}</td>
                <td>₹{product.cost_price}</td>

                {canManage && (
                  <td>
                    <button onClick={() => handleEdit(product)}>
                      Edit
                    </button>

                    <button onClick={() => handleDeactivate(product.id)}>
                      Deactivate
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {products.length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4}>
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Products;
