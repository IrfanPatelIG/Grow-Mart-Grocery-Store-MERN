import { useEffect, useState } from "react";
import { useAppContext } from "../../context/AppContext.jsx";
import toast from "react-hot-toast";

const initialDashboard = {
  summary: { productCount: 0, orderCount: 0, lowStockCount: 0, totalSales: 0 },
  lowStockProducts: [],
  recentOrders: [],
  products: [],
};

function StaffDashboard() {
  const { axios, currency, user } = useAppContext();
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [products, setProducts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockValues, setStockValues] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    price: "",
    offerPrice: "",
    description: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await axios.get("/api/product/staff-dashboard");
        if (!data.success) {
          throw new Error(data.message);
        }
        setDashboard(data);
        setProducts(data.products || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || requestError.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [axios]);

  if (isLoading) {
    return <main className="flex-1 p-6 md:p-10">Loading dashboard...</main>;
  }

  if (error) {
    return <main className="flex-1 p-6 md:p-10 text-red-600">{error}</main>;
  }

  const { summary, lowStockProducts, recentOrders } = dashboard;
  const metrics = [
    ["Products", summary.productCount],
    ["Recent orders", summary.orderCount],
    ["Low stock", summary.lowStockCount],
    ["Recent sales", `${currency}${summary.totalSales.toFixed(2)}`],
  ];

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Delete this product?")) {
      return;
    }
    try {
      const { data } = await axios.delete(`/api/product/${productId}`);
      if (!data.success) {
        throw new Error(data.message);
      }
      setProducts((currentProducts) => currentProducts.filter((product) => product._id !== productId));
      toast.success(data.message);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || requestError.message);
    }
  };

  const handleStockUpdate = async (product) => {
    const quantity = Number(stockValues[product._id] ?? product.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      toast.error("Stock quantity must be a whole number of zero or more");
      return;
    }
    try {
      const { data } = await axios.post("/api/product/stock", {
        id: product._id,
        quantity,
      });
      if (!data.success) {
        throw new Error(data.message);
      }
      setProducts((currentProducts) => currentProducts.map((currentProduct) => (
        currentProduct._id === product._id ? data.product : currentProduct
      )));
      setStockValues((currentValues) => ({ ...currentValues, [product._id]: data.product.quantity }));
      toast.success(data.message);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || requestError.message);
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
      setProducts((currentProducts) => currentProducts.map((product) => (
        product._id === editingProduct ? data.product : product
      )));
      setEditingProduct(null);
      toast.success(data.message);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || requestError.message);
    }
  };

  return (
    <main className="flex-1 min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-sm text-gray-500">Staff workspace</p>
          <h1 className="text-2xl font-semibold text-gray-900">Welcome, {user?.name}</h1>
        </header>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-md border border-gray-200 bg-white p-5">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-md border border-gray-200 bg-white p-5">
            <h2 className="font-medium text-gray-900">Low stock products</h2>
            {lowStockProducts.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">All products have healthy stock.</p>
            ) : (
              <div className="mt-4 divide-y divide-gray-100">
                {lowStockProducts.slice(0, 6).map((product) => (
                  <div key={product._id} className="flex items-center justify-between py-3 text-sm">
                    <span className="truncate pr-4">{product.name}</span>
                    <span className="font-medium text-red-600">{product.quantity} left</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-5">
            <h2 className="font-medium text-gray-900">Recent orders</h2>
            {recentOrders.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No orders yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-gray-100">
                {recentOrders.slice(0, 6).map((order) => (
                  <div key={order._id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p>{order.items.length} item{order.items.length === 1 ? "" : "s"}</p>
                      <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="font-medium">{currency}{order.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium text-gray-900">Product inventory</h2>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm outline-none">
              <option value="All">All categories</option>
              {[...new Set(products.map((product) => product.category))].sort().map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          {editingProduct && (
            <form onSubmit={handleProductUpdate} className="mt-4 space-y-3 rounded-md border border-gray-200 p-4">
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
                <button type="submit" className="cursor-pointer rounded-[5px] bg-primary px-4 py-2 text-white">Save</button>
                <button type="button" onClick={() => setEditingProduct(null)} className="cursor-pointer rounded-[5px] bg-gray-500 px-4 py-2 text-white">Cancel</button>
              </div>
            </form>
          )}
          {products.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No products listed.</p>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {products.filter((product) => categoryFilter === "All" || product.category === categoryFilter).map((product) => (
                <div key={product._id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">No image</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-gray-500">Current stock: {product.quantity}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      aria-label={`Stock quantity for ${product.name}`}
                      value={stockValues[product._id] ?? product.quantity}
                      onChange={(event) => setStockValues({ ...stockValues, [product._id]: event.target.value })}
                      className="w-20 rounded-md border border-gray-300 px-2 py-2 text-center outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleStockUpdate(product)}
                      className="rounded-md bg-primary/10 px-3 py-2 text-primary-dull hover:bg-primary/20"
                    >
                      Update stock
                    </button>
                    <button
                      type="button"
                      onClick={() => startProductEdit(product)}
                      className="rounded-md bg-primary/10 px-3 py-2 text-primary-dull hover:bg-primary/20"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product._id)}
                      className="rounded-md bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default StaffDashboard;