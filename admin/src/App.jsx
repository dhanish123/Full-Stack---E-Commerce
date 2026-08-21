import { useEffect, useMemo, useState } from "react"
import axios from "axios"

const API_BASE = "http://localhost:5000/api"

function App() {
  const [token, setToken] = useState(localStorage.getItem("admin_token") || "")
  const [user, setUser] = useState(null)
  
  // Auth Form State
  const [loginEmail, setLoginEmail] = useState("admin@aura.com")
  const [loginPassword, setLoginPassword] = useState("admin123")
  const [authError, setAuthError] = useState("")
  const [authLoading, setAuthLoading] = useState(false)

  // Active Tab
  const [activeTab, setActiveTab] = useState("dashboard")

  // Dashboard Data State
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState("")

  // Products State
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [productCategoryFilter, setProductCategoryFilter] = useState("ALL")
  const [productStockFilter, setProductStockFilter] = useState("ALL")
  const [productFormOpen, setProductFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productFormData, setProductFormData] = useState({
    name: "",
    price: "",
    category: "Electronics",
    imageUrl: "",
    description: "",
    stock: "10"
  })
  const [productFormError, setProductFormError] = useState("")
  const [productFormSubmitting, setProductFormSubmitting] = useState(false)

  // Orders State
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderSearch, setOrderSearch] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL")

  // Users State
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState("ALL")

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    return products.filter(product => {
      const matchesSearch = !query || [product.name, product.category, product.description]
        .some(value => value?.toLowerCase().includes(query))
      const matchesCategory = productCategoryFilter === "ALL" || product.category === productCategoryFilter
      const matchesStock = productStockFilter === "ALL"
        || (productStockFilter === "LOW" && product.stock <= 3)
        || (productStockFilter === "IN_STOCK" && product.stock > 3)
      return matchesSearch && matchesCategory && matchesStock
    })
  }, [products, productSearch, productCategoryFilter, productStockFilter])

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase()
    return orders.filter(order => {
      const productNames = order.items?.map(item => item.product?.name || "").join(" ") || ""
      const matchesSearch = !query || [String(order.id), order.customerEmail, order.customerName, productNames]
        .some(value => value?.toLowerCase().includes(query))
      return matchesSearch && (orderStatusFilter === "ALL" || order.status === orderStatusFilter)
    })
  }, [orders, orderSearch, orderStatusFilter])

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    return users.filter(account => {
      const matchesSearch = !query || [String(account.id), account.name, account.email]
        .some(value => value?.toLowerCase().includes(query))
      return matchesSearch && (userRoleFilter === "ALL" || account.role === userRoleFilter)
    })
  }, [users, userSearch, userRoleFilter])

  // Fetch token user context
  useEffect(() => {
    if (token) {
      axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setUser(res.data)
        if (res.data.role !== "ADMIN") {
          setAuthError("Access denied. Admin role required.")
          handleLogout()
        }
      })
      .catch(() => {
        handleLogout()
      })
    }
  }, [token])

  // Fetch data depending on active tab
  useEffect(() => {
    if (!token || !user) return

    if (activeTab === "dashboard") {
      fetchDashboardStats()
    } else if (activeTab === "products") {
      fetchProducts()
    } else if (activeTab === "orders") {
      fetchOrders()
    } else if (activeTab === "users") {
      fetchUsers()
    }
  }, [activeTab, token, user])

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError("")
    setAuthLoading(true)

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email: loginEmail,
        password: loginPassword
      })
      
      const { token: userToken, user: userData } = res.data
      if (userData.role !== "ADMIN") {
        setAuthError("Unauthorized: Admin access required.")
        setAuthLoading(false)
        return
      }

      localStorage.setItem("admin_token", userToken)
      setToken(userToken)
      setUser(userData)
    } catch (err) {
      setAuthError(err.response?.data?.error || "Invalid credentials or server offline.")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_token")
    setToken("")
    setUser(null)
  }

  // API Call Helpers
  const fetchDashboardStats = async () => {
    setStatsLoading(true)
    setStatsError("")
    try {
      const res = await axios.get(`${API_BASE}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setStats(res.data)
    } catch (err) {
      setStatsError(err.response?.data?.error || "Failed to load dashboard summary.")
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchProducts = async () => {
    setProductsLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/products`)
      setProducts(res.data)
    } catch {
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchOrders = async () => {
    setOrdersLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setOrders(res.data)
    } catch {
    } finally {
      setOrdersLoading(false)
    }
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
    } catch {
    } finally {
      setUsersLoading(false)
    }
  }

  // Product CRUD Handlers
  const handleOpenAddProduct = () => {
    setEditingProduct(null)
    setProductFormData({
      name: "",
      price: "",
      category: "Electronics",
      imageUrl: "",
      description: "",
      stock: "10"
    })
    setProductFormError("")
    setProductFormOpen(true)
  }

  const handleOpenEditProduct = (prod) => {
    setEditingProduct(prod)
    setProductFormData({
      name: prod.name,
      price: prod.price.toString(),
      category: prod.category,
      imageUrl: prod.imageUrl,
      description: prod.description,
      stock: prod.stock.toString()
    })
    setProductFormError("")
    setProductFormOpen(true)
  }

  const handleProductFormSubmit = async (e) => {
    e.preventDefault()
    setProductFormSubmitting(true)
    setProductFormError("")

    const { name, price, category, imageUrl, description, stock } = productFormData
    if (!name || !price || !description || !category) {
      setProductFormError("Please fill out all required fields.")
      setProductFormSubmitting(false)
      return
    }

    const payload = {
      name,
      price: parseFloat(price),
      category,
      imageUrl: imageUrl || undefined,
      description,
      stock: parseInt(stock)
    }

    try {
      if (editingProduct) {
        const res = await axios.put(`${API_BASE}/products/${editingProduct.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? res.data : p))
      } else {
        const res = await axios.post(`${API_BASE}/products`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setProducts(prev => [...prev, res.data])
      }
      setProductFormOpen(false)
    } catch (err) {
      setProductFormError(err.response?.data?.error || "Failed to save product.")
    } finally {
      setProductFormSubmitting(false)
    }
  }

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return

    try {
      await axios.delete(`${API_BASE}/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      alert("Failed to delete product.")
    }
  }

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await axios.put(`${API_BASE}/admin/orders/${orderId}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o))
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(res.data)
      }
    } catch (err) {
      alert("Failed to update status")
    }
  }

  // Render Login view if not authenticated
  if (!token || !user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-logo">AURA</h1>
            <p className="auth-subtitle">Admin Management Portal</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="admin@aura.com" 
                value={loginEmail} 
                onChange={(e) => setLoginEmail(e.target.value)} 
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                required
              />
            </div>

            {authError && <p className="text-error mb-4">{authError}</p>}

            <button type="submit" className="btn-primary" disabled={authLoading}>
              {authLoading ? "Verifying..." : "Sign In to Portal"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h1 className="sidebar-logo">AURA</h1>
        <ul className="nav-menu">
          <li 
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </li>
          <li 
            className={`nav-item ${activeTab === "products" ? "active" : ""}`}
            onClick={() => setActiveTab("products")}
          >
            Products
          </li>
          <li 
            className={`nav-item ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Orders
          </li>
          <li 
            className={`nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </li>
        </ul>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-danger w-full">
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Dashboard Space */}
      <main className="main-content">
        <header className="header">
          <div>
            <h1 className="page-title">{activeTab.toUpperCase()}</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
              Welcome back, {user.name || "Administrator"}
            </p>
          </div>
          <div className="user-profile">
            <div className="avatar">
              {(user.name || "A")[0].toUpperCase()}
            </div>
            <span style={{ fontSize: "14px", fontWeight: "600" }}>{user.email}</span>
          </div>
        </header>

        {/* Tab contents */}
        {activeTab === "dashboard" && (
          <div>
            {statsLoading ? (
              <p>Loading summary data...</p>
            ) : statsError ? (
              <p className="text-error">{statsError}</p>
            ) : !stats ? (
              <p className="text-error">Dashboard summary is unavailable.</p>
            ) : (
              <div>
                <div className="stats-grid">
                  <div className="stat-card revenue">
                    <span className="stat-icon">₹</span>
                    <span className="stat-label">Total Revenue</span>
                    <span className="stat-value">₹{stats.totalRevenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="stat-card orders">
                    <span className="stat-icon">📦</span>
                    <span className="stat-label">Orders Handled</span>
                    <span className="stat-value">{stats.totalOrders}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">🛍️</span>
                    <span className="stat-label">Total Products</span>
                    <span className="stat-value">{stats.totalProducts}</span>
                  </div>
                  <div className="stat-card users">
                    <span className="stat-icon">👥</span>
                    <span className="stat-label">Registered Users</span>
                    <span className="stat-value">{stats.totalUsers}</span>
                  </div>
                </div>

                <div className="content-grid">
                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Recent Transactions</h3>
                    </div>
                    <div className="table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Products</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentOrders.map(order => (
                            <tr key={order.id}>
                              <td>#{order.id}</td>
                              <td>{order.customerName || "Guest User"}</td>
                              <td>
                                {order.items && order.items.map(item => (
                                  <div key={item.id} style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                    {item.product?.name || "Product"} (x{item.quantity})
                                  </div>
                                ))}
                              </td>
                              <td>₹{order.amount.toFixed(2)}</td>
                              <td>
                                <span className={`badge badge-${
                                  order.status === 'CANCELLED' ? 'danger' :
                                  order.status === 'PENDING' ? 'warning' :
                                  order.status === 'PAID' || order.status === 'PLACED' ? 'success' :
                                  order.status === 'SHIPPED' || order.status === 'DELIVERED' ? 'info' : 'info'
                                }`}>
                                  {order.status}
                                </span>
                              </td>
                              <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h3 className="card-title">Sales by Category</h3>
                      {stats.revenueBreakdown && (
                        <div className="revenue-totals" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {Object.entries(stats.revenueBreakdown).filter(([,v]) => v > 0).map(([k, v]) => (
                            <span key={k} style={{ marginLeft: "10px" }}>
                              <strong style={{ color: "var(--text-primary)" }}>{k}</strong>: ₹{v.toLocaleString("en-IN")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="category-list">
                      {stats.categorySales.map((cat, i) => (
                        <div className="category-item" key={i}>
                          <div className="category-name-wrapper">
                            <span className="category-dot"></span>
                            <span className="category-name">{cat.category}</span>
                          </div>
                          <span className="category-value">₹{cat.value.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "products" && (
          <div className="card">
            <div className="flex-between mb-4">
              <h3 className="card-title">All Products ({filteredProducts.length}{filteredProducts.length !== products.length ? ` of ${products.length}` : ""})</h3>
              <button className="btn-primary" style={{ width: "auto" }} onClick={handleOpenAddProduct}>
                + Add Product
              </button>
            </div>
            <div className="filter-bar">
              <input className="filter-search" type="search" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products, categories..." />
              <select className="filter-select" value={productCategoryFilter} onChange={(e) => setProductCategoryFilter(e.target.value)}>
                <option value="ALL">All categories</option>
                {[...new Set(products.map(product => product.category))].sort().map(category => <option key={category} value={category}>{category}</option>)}
              </select>
              <select className="filter-select" value={productStockFilter} onChange={(e) => setProductStockFilter(e.target.value)}>
                <option value="ALL">All stock</option>
                <option value="IN_STOCK">In stock</option>
                <option value="LOW">Low stock</option>
              </select>
            </div>
            
            {productsLoading ? (
              <p>Loading inventory...</p>
            ) : (
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(prod => (
                      <tr key={prod.id}>
                        <td>
                          <img src={prod.imageUrl} alt={prod.name} style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }} />
                        </td>
                        <td>{prod.name}</td>
                        <td>{prod.category}</td>
                        <td>₹{prod.price.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${prod.stock > 3 ? "badge-success" : "badge-danger"}`}>
                            {prod.stock} items
                          </span>
                        </td>
                        <td>
                          <button className="btn-secondary" style={{ marginRight: "8px", padding: "6px 12px" }} onClick={() => handleOpenEditProduct(prod)}>
                            Edit
                          </button>
                          <button className="btn-danger" style={{ padding: "6px 12px" }} onClick={() => handleDeleteProduct(prod.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!filteredProducts.length && <tr><td className="empty-state" colSpan="6">No products match your filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="card">
            <h3 className="card-title mb-4">Orders Registry ({filteredOrders.length}{filteredOrders.length !== orders.length ? ` of ${orders.length}` : ""})</h3>
            <div className="filter-bar">
              <input className="filter-search" type="search" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search order ID, customer, product..." />
              <select className="filter-select" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="PLACED">Placed</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            {ordersLoading ? (
              <p>Loading orders ledger...</p>
            ) : (
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer Email</th>
                      <th>Products</th>
                      <th>Total Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>{order.customerEmail || "N/A"}</td>
                        <td>
                          {order.items && order.items.map(item => (
                            <div key={item.id} style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                              {item.product?.name || "Product"} (x{item.quantity})
                            </div>
                          ))}
                        </td>
                        <td>₹{order.amount.toFixed(2)}</td>
                        <td>
                          <span className={`badge badge-${
                            order.status === 'CANCELLED' ? 'danger' :
                            order.status === 'PENDING' ? 'warning' :
                            order.status === 'PAID' || order.status === 'PLACED' ? 'success' :
                            order.status === 'SHIPPED' || order.status === 'DELIVERED' ? 'info' : 'info'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <button className="btn-secondary" style={{ padding: "6px 12px", marginRight: "8px" }} onClick={() => setSelectedOrder(order)}>
                            Manage
                          </button>
                          <select 
                            value={order.status} 
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            style={{ background: "var(--bg-tertiary)", color: "white", padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PAID">PAID</option>
                            <option value="PLACED">PLACED</option>
                            <option value="SHIPPED">SHIPPED</option>
                            <option value="DELIVERED">DELIVERED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {!filteredOrders.length && <tr><td className="empty-state" colSpan="6">No orders match your filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="card">
            <h3 className="card-title mb-4">Platform Users ({filteredUsers.length}{filteredUsers.length !== users.length ? ` of ${users.length}` : ""})</h3>
            <div className="filter-bar">
              <input className="filter-search" type="search" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search name, email, or ID..." />
              <select className="filter-select" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)}>
                <option value="ALL">All roles</option>
                <option value="USER">Users</option>
                <option value="ADMIN">Admins</option>
              </select>
            </div>
            {usersLoading ? (
              <p>Loading registry...</p>
            ) : (
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td>{u.name || "N/A"}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : 'badge-info'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {!filteredUsers.length && <tr><td className="empty-state" colSpan="5">No users match your filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Form Modal */}
      {productFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingProduct ? "Edit Product Details" : "Add New Inventory Item"}</h3>
              <button className="close-btn" onClick={() => setProductFormOpen(false)}>×</button>
            </div>

            <form onSubmit={handleProductFormSubmit}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={productFormData.name} 
                  onChange={(e) => setProductFormData({...productFormData, name: e.target.value})} 
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Price (INR)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-input" 
                    value={productFormData.price} 
                    onChange={(e) => setProductFormData({...productFormData, price: e.target.value})} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock Units</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={productFormData.stock} 
                    onChange={(e) => setProductFormData({...productFormData, stock: e.target.value})} 
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select 
                  className="form-input" 
                  value={productFormData.category}
                  onChange={(e) => setProductFormData({...productFormData, category: e.target.value})}
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Home Decor">Home Decor</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Image URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://example.com/image.jpg"
                  value={productFormData.imageUrl} 
                  onChange={(e) => setProductFormData({...productFormData, imageUrl: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Product Description</label>
                <textarea 
                  className="form-input" 
                  rows="4"
                  value={productFormData.description} 
                  onChange={(e) => setProductFormData({...productFormData, description: e.target.value})} 
                  required
                />
              </div>

              {productFormError && <p className="text-error mb-4">{productFormError}</p>}

              <button type="submit" className="btn-primary" disabled={productFormSubmitting}>
                {productFormSubmitting ? "Saving..." : "Commit Inventory Change"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order View Modal */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "700px" }}>
            <div className="modal-header">
              <h3>Order Ledger Details</h3>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="flex-between">
                <span>Order ID: <strong>#{selectedOrder.id}</strong></span>
                <span className={`badge badge-${
                  selectedOrder.status === 'CANCELLED' ? 'danger' :
                  selectedOrder.status === 'PENDING' ? 'warning' :
                  selectedOrder.status === 'PAID' || selectedOrder.status === 'PLACED' ? 'success' :
                  selectedOrder.status === 'SHIPPED' || selectedOrder.status === 'DELIVERED' ? 'info' : 'info'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid var(--glass-border)" }} />
              <div>
                <h4 className="mb-4">Customer Details</h4>
                <p>Name: {selectedOrder.customerName || "Guest"}</p>
                <p>Email: {selectedOrder.customerEmail || "N/A"}</p>
                <p>Phone: {selectedOrder.customerPhone || "N/A"}</p>
                <p>Shipping Address: {selectedOrder.shippingAddress || "N/A"}</p>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid var(--glass-border)" }} />
              <div>
                <h4 className="mb-4">Order Items</h4>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Unit Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.product?.name || `Product ID: ${item.productId}`}</td>
                        <td>{item.quantity}</td>
                        <td>₹{item.price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid var(--glass-border)" }} />
              <div className="flex-between">
                <span>Grand Total:</span>
                <strong style={{ fontSize: "18px" }}>₹{selectedOrder.amount.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
