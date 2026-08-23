import React, { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { toast } from "react-hot-toast";

function ProductList() {
  const { products, currency, axios, fetchProducts } = useAppContext();
  const [editState, setEditState] = useState({}); // { productId: {value, editing} }
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    price: "",
    offerPrice: "",
    description: "",
  });
  const [categoryFilter, setCategoryFilter] = useState("All");

  const handleEdit = (id, quantity) => {
    setEditState((prev) => ({
      ...prev,
      [id]: { value: quantity, editing: true },
    }));
  };

  const handleChange = (id, value) => {
    setEditState((prev) => ({
      ...prev,
      [id]: { ...prev[id], value },
    }));
  };

  const handleCancel = (id, quantity) => {
    setEditState((prev) => ({
      ...prev,
      [id]: { value: quantity, editing: false },
    }));
  };

  const handleUpdate = async (id) => {
    try {
      const { value } = editState[id];
      const { data } = await axios.post("/api/product/stock", {
        id,
        quantity: parseInt(value, 10),
      });
      if (data.success) {
        toast.success("Quantity updated");
        setEditState((prev) => ({
          ...prev,
          [id]: { ...prev[id], editing: false },
        }));
        fetchProducts();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) {
      return;
    }
    try {
      const { data } = await axios.delete(`/api/product/${id}`);
      if (data.success) {
        toast.success(data.message);
        fetchProducts();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const startProductEdit = (product) => {
    setEditingProduct(product._id);
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price,
      offerPrice: product.offerPrice,
      description: Array.isArray(product.description) ? product.description.join("\n") : product.description || "",
    });
  };

  const handleProductUpdate = async (event) => {
    event.preventDefault();
    try {
      const { data } = await axios.put(`/api/product/${editingProduct}`, {
        ...productForm,
        description: productForm.description.split("\n"),
      });
      if (!data.success) {
        throw new Error(data.message);
      }
      toast.success(data.message);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  return (
    <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between">
      <div className="w-full md:p-10 p-4">
        <div className="flex items-center justify-between gap-3 pb-4">
          <h2 className="text-lg font-medium">All Products</h2>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm outline-none">
            <option value="All">All categories</option>
            {[...new Set(products.map((product) => product.category))].sort().map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        {editingProduct && (
          <form onSubmit={handleProductUpdate} className="mb-5 max-w-4xl rounded-md border border-gray-300 bg-white p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {[["name", "Name"], ["category", "Category"], ["price", "Price"], ["offerPrice", "Offer price"]].map(([field, label]) => (
                <label key={field} className="flex flex-col gap-1 text-sm">
                  {label}
                  <input
                    required
                    min={field === "price" || field === "offerPrice" ? "0" : undefined}
                    type={field === "price" || field === "offerPrice" ? "number" : "text"}
                    value={productForm[field]}
                    onChange={(event) => setProductForm({ ...productForm, [field]: event.target.value })}
                    className="rounded border border-gray-400 px-3 py-2 outline-none"
                  />
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Description
              <textarea
                rows={3}
                value={productForm.description}
                onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                className="resize-none rounded border border-gray-400 px-3 py-2 outline-none"
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-[5px] bg-primary px-4 py-2 text-white cursor-pointer">Save</button>
              <button type="button" onClick={() => setEditingProduct(null)} className="rounded-[5px] bg-gray-500 px-4 py-2 text-white cursor-pointer">Cancel</button>
            </div>
          </form>
        )}
        <div className="flex flex-col items-center max-w-4xl w-full overflow-hidden rounded-md bg-white border border-gray-500/20">
          <table className="md:table-auto table-fixed w-full overflow-hidden">
            <thead className="text-gray-900 text-sm text-left">
              <tr>
                <th className="px-4 py-3 font-semibold truncate">Product</th>
                <th className="px-4 py-3 font-semibold truncate">Category</th>
                <th className="px-4 py-3 font-semibold truncate hidden md:block">Selling Price</th>
                <th className="px-4 py-3 font-semibold truncate">Quantity</th>
                <th className="px-4 py-3 font-semibold truncate">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-500">
              {products.filter((product) => categoryFilter === "All" || product.category === categoryFilter).map((product) => {
                const state = editState[product._id] || {
                  value: product.quantity,
                  editing: false,
                };

                return (
                  <tr key={product._id} className="border-t border-gray-500/20">
                    <td className="md:px-4 pl-2 md:pl-4 py-3 flex items-center space-x-3 truncate">
                      <div className="border border-gray-300 rounded overflow-hidden">
                        <img src={product.images[0]} alt="Product" className="w-16" />
                      </div>
                      <span className="truncate max-sm:hidden w-full">{product.name}</span>
                    </td>
                    <td className="px-4 py-3">{product.category}</td>
                    <td className="px-4 py-3 max-sm:hidden">
                      {currency}
                      {product.offerPrice}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={state.value}
                          onChange={(e) => handleChange(product._id, e.target.value)}
                          onFocus={() => handleEdit(product._id, product.quantity)}
                          className="w-20 px-2 py-1 border border-gray-400 rounded outline-none text-center"
                        />
                        {state.editing && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdate(product._id)}
                              className="px-3 py-1 bg-primary hover:bg-primary-dull text-white cursor-pointer rounded-[5px]"
                            >
                              Update
                            </button>
                            <button
                              onClick={() => handleCancel(product._id, product.quantity)}
                              className="px-3 py-1 bg-gray-500 text-white rounded-[5px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startProductEdit(product)}
                          className="px-3 py-1 bg-primary/10 text-primary-dull hover:bg-primary/20 rounded-[5px] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product._id)}
                          className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-[5px] cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ProductList;
