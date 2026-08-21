import { useCallback, useEffect, useRef, useState } from "react"
import axios from "axios"
import { useDispatch, useSelector } from "react-redux"
import { clearCart, decreaseCartItem, removeCartItem, replaceCart } from "./store/cartSlice"

const API_BASE = "http://localhost:5000"

const axiosInstance = axios.create({
  baseURL: API_BASE,
})

const loadRazorpayScript = () => new Promise((resolve) => {
  if (window.Razorpay) {
    resolve(true)
    return
  }

  const script = document.createElement("script")
  script.src = "https://checkout.razorpay.com/v1/checkout.js"
  script.onload = () => resolve(true)
  script.onerror = () => resolve(false)
  document.body.appendChild(script)
})

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("aura_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

function App() {
  const dispatch = useDispatch()
  const cart = useSelector(state => state.cart)

  // Auth State
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem("aura_token") || null)
  const [authModalOpen, setAuthModalOpen] = useState(() => new URLSearchParams(window.location.search).has("resetToken"))
  const [authMode, setAuthMode] = useState(() => new URLSearchParams(window.location.search).has("resetToken") ? "reset" : "login")
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "", newPassword: "" })
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authError, setAuthError] = useState("")
  const [resetMessage, setResetMessage] = useState("")
  const [resetUrl, setResetUrl] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileUploading, setProfileUploading] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", gender: "" })
  const [addresses, setAddresses] = useState([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressFormOpen, setAddressFormOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [addressSubmitting, setAddressSubmitting] = useState(false)
  const [addressLocating, setAddressLocating] = useState(false)
  const [locationError, setLocationError] = useState("")
  const [openAddressMenuId, setOpenAddressMenuId] = useState(null)
  const addressMenuRef = useRef(null)
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [checkoutAddressFormOpen, setCheckoutAddressFormOpen] = useState(false)
  const [manualAddressEntry, setManualAddressEntry] = useState(false)
  const [addressForm, setAddressForm] = useState({
    name: "", phone: "", pincode: "", locality: "", address: "",
    city: "", state: "", landmark: "", altPhone: "", addressType: "Home", isDefault: false
  })
  const INDIAN_STATES = [
    "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
    "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra",
    "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim",
    "Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
    "Andaman & Nicobar","Chandigarh","Dadra & Nagar Haveli","Daman & Diu","Delhi","Jammu & Kashmir",
    "Ladakh","Lakshadweep","Puducherry"
  ]

  // Products State
  const [products, setProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  
  // Interactive Cart State
  const [isCartAnimating, setIsCartAnimating] = useState(false)
  const [currentView, setCurrentView] = useState("catalog")
  const [checkoutStep, setCheckoutStep] = useState("cart")

  // Selected Product for Details Modal
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Add Product Form States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: "",
    price: "",
    category: "Electronics",
    imageUrl: "",
    description: "",
    stock: "10"
  })
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewProduct(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAddProductSubmit = async (e) => {
    e.preventDefault()
    setFormSubmitting(true)
    setFormError("")

    // Basic validation
    if (!newProduct.name || !newProduct.price || !newProduct.description || !newProduct.category) {
      setFormError("Please fill out all required fields (Name, Price, Category, Description).")
      setFormSubmitting(false)
      return
    }

    try {
      const response = await axiosInstance.post("/api/products", newProduct)
      // Append the new product to the list
      setProducts(prev => [...prev, response.data])
      
      // Reset form and close modal
      setNewProduct({
        name: "",
        price: "",
        category: "Electronics",
        imageUrl: "",
        description: "",
        stock: "10"
      })
      setIsAddModalOpen(false)
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to create product. Make sure the server is online.")
    } finally {
      setFormSubmitting(false)
    }
  }

  // Edit/Delete Product States & Handlers
  const [editingProduct, setEditingProduct] = useState(null)
  const [editFormError, setEditFormError] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState(null)

  // Checkout States
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")
  const [paymentResult, setPaymentResult] = useState(null)
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    email: "",
    phone: "",
    shippingAddress: ""
  })
  const [successfulOrder, setSuccessfulOrder] = useState(null)

  // My Orders States
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  // Invoice Modal State
  const [invoiceOrder, setInvoiceOrder] = useState(null)

  // ──────────────────────────────────────────────────
  // AUTH HANDLERS
  // ──────────────────────────────────────────────────
  const handleAuthInputChange = (e) => {
    const { name, value } = e.target
    setAuthForm(prev => ({ ...prev, [name]: value }))
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthSubmitting(true)
    setAuthError("")

    if (authMode === "forgot") {
      if (!authForm.email) {
        setAuthError("Email is required.")
        setAuthSubmitting(false)
        return
      }
      try {
        const res = await axios.post(`${API_BASE}/api/auth/forgot-password`, { email: authForm.email })
        setResetMessage(res.data.message)
        setResetUrl(res.data.resetUrl || "")
      } catch (err) {
        setAuthError(err.response?.data?.error || "Unable to request a reset link.")
      } finally {
        setAuthSubmitting(false)
      }
      return
    }

    if (authMode === "reset") {
      if (!authForm.newPassword) {
        setAuthError("New password is required.")
        setAuthSubmitting(false)
        return
      }
      try {
        await axios.post(`${API_BASE}/api/auth/reset-password`, {
          token: new URLSearchParams(window.location.search).get("resetToken"),
          password: authForm.newPassword
        })
        window.history.replaceState({}, "", window.location.pathname)
        setAuthMode("login")
        setAuthForm({ email: "", password: "", name: "", newPassword: "" })
        setResetMessage("Password reset successfully. You can now sign in.")
      } catch (err) {
        setAuthError(err.response?.data?.error || "Unable to reset password.")
      } finally {
        setAuthSubmitting(false)
      }
      return
    }

    if (!authForm.email || !authForm.password) {
      setAuthError("Email and password are required.")
      setAuthSubmitting(false)
      return
    }

    if (authMode === "register" && !authForm.name) {
      setAuthError("Name is required for registration.")
      setAuthSubmitting(false)
      return
    }

    try {
      const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login"
      const payload = authMode === "register"
        ? { email: authForm.email, password: authForm.password, name: authForm.name }
        : { email: authForm.email, password: authForm.password }

      const res = await axios.post(API_BASE + endpoint, payload)

      const { token: newToken, user: newUser } = res.data
      localStorage.setItem("aura_token", newToken)
      setToken(newToken)
      setUser(newUser)
      setCustomerDetails(prev => ({
        ...prev,
        name: prev.name || newUser.name || "",
        email: prev.email || newUser.email || ""
      }))

      setAuthModalOpen(false)
      setAuthForm({ email: "", password: "", name: "", newPassword: "" })

      fetchCart()
      fetchAddresses()
    } catch (err) {
      setAuthError(err.response?.data?.error || "Authentication failed. Please try again.")
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("aura_token")
    setToken(null)
    setUser(null)
    dispatch(clearCart())
    setOrders([])
  }

  const requireAuth = (callback) => {
    if (!token || !user) {
      setAuthModalOpen(true)
      return false
    }
    if (callback) callback()
    return true
  }

  const handleStartProfileEdit = () => {
    if (!user) return
    setProfileForm({
      name: user.name || "",
      phone: user.phone || "",
      gender: user.gender || ""
    })
    setProfileEditing(true)
  }

  const handleProfileInputChange = (e) => {
    const { name, value } = e.target
    setProfileForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault()
    setProfileSaving(true)
    try {
      const res = await axiosInstance.patch("/api/user/profile", profileForm)
      setUser(res.data)
      setProfileEditing(false)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileUploading(true)
    try {
      const formData = new FormData()
      formData.append("avatar", file)
      const res = await axiosInstance.post("/api/user/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      setUser(res.data.user)
    } finally {
      setProfileUploading(false)
      e.target.value = ""
    }
  }

  const fetchAddresses = useCallback(async () => {
    if (!token) return
    setAddressLoading(true)
    try {
      const res = await axiosInstance.get("/api/user/addresses")
      setAddresses(res.data)
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout()
      }
    } finally {
      setAddressLoading(false)
    }
  }, [token])

  const handleOpenAddressForm = (address = null) => {
    if (address) {
      setEditingAddressId(address.id)
      setAddressForm({
        name: address.name || "",
        phone: address.phone || "",
        pincode: address.pincode || "",
        locality: address.locality || "",
        address: address.address || "",
        city: address.city || "",
        state: address.state || "",
        landmark: address.landmark || "",
        altPhone: address.altPhone || "",
        addressType: address.addressType || "Home",
        isDefault: !!address.isDefault
      })
    } else {
      setEditingAddressId(null)
      setAddressForm({
        name: user?.name || "",
        phone: user?.phone || "",
        pincode: "",
        locality: "",
        address: "",
        city: "",
        state: "",
        landmark: "",
        altPhone: "",
        addressType: "Home",
        isDefault: addresses.length === 0
      })
    }
    setAddressFormOpen(true)
  }

  const handleCloseAddressForm = () => {
    setAddressFormOpen(false)
    setEditingAddressId(null)
  }

  const handleAddressInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setAddressForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }))
  }

  const handleSaveAddress = async (e) => {
    e.preventDefault()
    if (!addressForm.name || !addressForm.phone || !addressForm.pincode || !addressForm.address || !addressForm.city || !addressForm.state) {
      return
    }
    setAddressSubmitting(true)
    try {
      if (editingAddressId) {
        await axiosInstance.put(`/api/user/addresses/${editingAddressId}`, addressForm)
      } else {
        await axiosInstance.post("/api/user/addresses", addressForm)
      }
      await fetchAddresses()
      handleCloseAddressForm()
    } finally {
      setAddressSubmitting(false)
    }
  }

  const handleDeleteAddress = async (id) => {
    axiosInstance.delete(`/api/user/addresses/${id}`)
      .then(() => fetchAddresses())
      .finally(() => setOpenAddressMenuId(null))
  }

  const handleSetDefaultAddress = async (id) => {
    const addr = addresses.find(a => a.id === id)
    if (!addr) return
    axiosInstance.put(`/api/user/addresses/${id}`, { ...addr, isDefault: true })
      .then(() => fetchAddresses())
      .finally(() => setOpenAddressMenuId(null))
  }

  const formatAddressString = (addr) => {
    if (!addr) return ""
    const parts = [
      addr.address,
      addr.locality,
      addr.landmark ? `Landmark: ${addr.landmark}` : null,
      addr.city,
      addr.state,
      addr.pincode ? `PIN: ${addr.pincode}` : null
    ].filter(Boolean)
    return parts.join(", ")
  }

  const handleSelectAddress = (addr) => {
    setSelectedAddressId(addr.id)
    setManualAddressEntry(false)
    setCustomerDetails(prev => ({
      ...prev,
      name: prev.name || addr.name || "",
      phone: prev.phone || addr.phone || "",
      shippingAddress: formatAddressString(addr)
    }))
  }

  const handleOpenCheckoutAddressForm = () => {
    setEditingAddressId(null)
    setAddressForm({
      name: customerDetails.name || user?.name || "",
      phone: customerDetails.phone || user?.phone || "",
      pincode: "",
      locality: "",
      address: "",
      city: "",
      state: "",
      landmark: "",
      altPhone: "",
      addressType: "Home",
      isDefault: addresses.length === 0
    })
    setCheckoutAddressFormOpen(true)
  }

  const handleCloseCheckoutAddressForm = () => {
    setCheckoutAddressFormOpen(false)
    setEditingAddressId(null)
  }

  const handleSaveCheckoutAddress = async (e) => {
    e.preventDefault()
    if (!addressForm.name || !addressForm.phone || !addressForm.pincode || !addressForm.address || !addressForm.city || !addressForm.state) {
      return
    }
    setAddressSubmitting(true)
    try {
      let savedAddr
      if (editingAddressId) {
        await axiosInstance.put(`/api/user/addresses/${editingAddressId}`, addressForm)
      } else {
        const res = await axiosInstance.post("/api/user/addresses", addressForm)
        savedAddr = res.data
      }
      await fetchAddresses()
      handleCloseCheckoutAddressForm()
      if (savedAddr) {
        handleSelectAddress(savedAddr)
      }
    } finally {
      setAddressSubmitting(false)
    }
  }

  const fetchCart = useCallback(async () => {
    if (!token) return
    try {
      const res = await axiosInstance.get("/api/cart")
      const flattenedCart = res.data.map(item => ({
        cartItemId: item.id,
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        imageUrl: item.product.imageUrl,
        stock: item.product.stock,
        quantity: item.quantity
      }))
      dispatch(replaceCart(flattenedCart))
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout()
      }
    }
  }, [token])

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditingProduct(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleEditProductSubmit = async (e) => {
    e.preventDefault()
    setEditSubmitting(true)
    setEditFormError("")

    if (!editingProduct.name || !editingProduct.price || !editingProduct.description || !editingProduct.category) {
      setEditFormError("Please fill out all required fields.")
      setEditSubmitting(false)
      return
    }

    try {
      const response = await axiosInstance.put(`/api/products/${editingProduct.id}`, {
        name: editingProduct.name,
        price: editingProduct.price,
        category: editingProduct.category,
        imageUrl: editingProduct.imageUrl,
        description: editingProduct.description,
        stock: editingProduct.stock
      })
      // Update local products list
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? response.data : p))
      setEditingProduct(null)
      // Update details modal if currently viewing this product
      if (selectedProduct?.id === editingProduct.id) {
        setSelectedProduct(response.data)
      }
    } catch (err) {
      setEditFormError(err.response?.data?.error || "Failed to update product.")
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (!deletingProductId) return

    try {
      await axiosInstance.delete(`/api/products/${deletingProductId}`)
      // Remove from local state
      setProducts(prev => prev.filter(p => p.id !== deletingProductId))
      // Close details modal if it was open for this product
      if (selectedProduct?.id === deletingProductId) {
        setSelectedProduct(null)
      }
      setDeletingProductId(null)
    } catch (err) {
      alert("Failed to delete product. Make sure the server is online.")
    }
  }

  useEffect(() => {
    axios.get(API_BASE + "/api/products")
      .then(res => {
        setProducts(res.data)
        setFilteredProducts(res.data)
        setLoading(false)
      })
      .catch(err => {
        setError("Could not connect to the API server. Please verify the server is running on http://localhost:5000.")
        setLoading(false)
      })

    if (token) {
      axiosInstance.get("/api/auth/me")
        .then(res => {
          setUser(res.data)
          fetchCart()
          fetchAddresses()
        })
        .catch(() => {
          handleLogout()
        })
    }

  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false)
      }
      if (addressMenuRef.current && !addressMenuRef.current.contains(e.target) && !e.target.closest(".address-menu-btn")) {
        setOpenAddressMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [profileMenuRef, addressMenuRef])

  // Pre-fill customer details from user profile on login
  useEffect(() => {
    if (user) {
      setCustomerDetails(prev => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.email || "",
        phone: prev.phone || user.phone || ""
      }))
    }
  }, [user])

  // Auto-select default address when addresses load & entering shipping step
  useEffect(() => {
    if (checkoutStep === "shipping" && addresses.length > 0 && !selectedAddressId && !manualAddressEntry) {
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0]
      if (defaultAddr && !customerDetails.shippingAddress) {
        handleSelectAddress(defaultAddr)
      }
    }
  }, [checkoutStep, addresses, selectedAddressId, manualAddressEntry])

  // Reset checkout address state when going back to cart
  useEffect(() => {
    if (checkoutStep === "cart") {
      setSelectedAddressId(null)
      setManualAddressEntry(false)
      setCheckoutAddressFormOpen(false)
    }
  }, [checkoutStep])

  const handleCustomerChange = (e) => {
    const { name, value } = e.target
    setCustomerDetails(prev => ({ ...prev, [name]: value }))
  }

  const fetchOrders = async () => {
    if (!requireAuth()) return
    setOrdersLoading(true)
    try {
      const res = await axiosInstance.get("/api/orders")
      setOrders(res.data)
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout()
      }
    } finally {
      setOrdersLoading(false)
    }
  }

  const handleOpenOrders = async () => {
    if (!requireAuth()) return
    setIsOrdersModalOpen(true)
    setExpandedOrderId(null)
    await fetchOrders()
  }

  const getStatusBadge = (status) => {
    const styles = {
      PLACED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      SHIPPED: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      CANCELLED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      PENDING: "bg-slate-500/10 text-slate-400 border-slate-500/20"
    }
    return styles[status] || styles.PENDING
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  }

  const formatInvoiceDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    })
  }

  const handlePrintInvoice = () => {
    window.print()
  }

  const generateInvoiceNumber = (orderId) => {
    return `AURA-INV-${String(orderId).padStart(6, "0")}`
  }

  const handleCheckout = async () => {
    if (!requireAuth()) return
    setCheckoutError("")

    if (!customerDetails.name || !customerDetails.email || !customerDetails.phone || !customerDetails.shippingAddress) {
      setCheckoutError("Please fill in all customer details before proceeding.")
      return
    }

    try {
      setOrderSubmitting(true)
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay Checkout")
      }

      const orderRes = await axiosInstance.post("/api/payments/create-order", customerDetails)
      const { keyId, razorpayOrder, order } = orderRes.data
      const paymentResponse = await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: keyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: "AURA",
          description: `Order #${order.id}`,
          order_id: razorpayOrder.id,
          prefill: {
            name: customerDetails.name,
            email: customerDetails.email,
            contact: customerDetails.phone
          },
          theme: { color: "#10b981" },
          handler: resolve,
          modal: { ondismiss: () => reject({ type: "cancelled", message: "Payment was cancelled" }) }
        })
        checkout.on("payment.failed", (response) => {
          reject({
            type: "declined",
            message: response.error?.description || "Razorpay declined the payment"
          })
        })
        checkout.open()
      })

      const verifiedRes = await axiosInstance.post("/api/payments/verify", {
        orderId: order.id,
        ...paymentResponse
      })
      const verifiedOrder = verifiedRes.data.order
      setSuccessfulOrder({
        ...verifiedOrder,
        items: verifiedOrder.items.map(item => ({
          ...item,
          name: item.product?.name || `Product #${item.productId}`
        }))
      })
      dispatch(clearCart())
      setCustomerDetails({ name: user?.name || "", email: user?.email || "", phone: "", shippingAddress: "" })
      setCurrentView("catalog")
      setCheckoutStep("cart")
      setPaymentResult({ type: "accepted", order: verifiedOrder })
      fetchOrders()
    } catch (err) {
      setPaymentResult({
        type: "declined",
        message: err.response?.data?.error || err.message || "Payment failed. Please try again."
      })
    } finally {
      setOrderSubmitting(false)
    }
  }

  // Apply search & category filters
  useEffect(() => {
    let result = products
    
    if (selectedCategory !== "All") {
      result = result.filter(p => p.category === selectedCategory)
    }
    
    if (searchQuery.trim() !== "") {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    setFilteredProducts(result)
  }, [searchQuery, selectedCategory, products])

  const handleAddToCart = async (product, e) => {
    if (!requireAuth()) return
    // Prevent opening modal if clicking the button on the card
    if (e) e.stopPropagation()
    
    try {
      // POST to database cart
      await axiosInstance.post("/api/cart", { productId: product.id })
      
      // Re-fetch cart items to keep local state synced
      await fetchCart()
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout()
      }
    }
    
    // Trigger cart badge micro-animation
    setIsCartAnimating(true)
    setTimeout(() => setIsCartAnimating(false), 300)
  }

  const handleRemoveFromCart = async (productId) => {
    const item = cart.find(i => i.id === productId)
    if (!item) return

    try {
      // DELETE from database cart
      await axiosInstance.delete(`/api/cart/${item.cartItemId}`)
      // Update local state
      dispatch(removeCartItem(productId))
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout()
      }
    }
  }

  const handleDecreaseQuantity = async (productId) => {
    const item = cart.find(i => i.id === productId)
    if (!item) return

    if (item.quantity <= 1) {
      return handleRemoveFromCart(productId)
    }

    try {
      // PUT to database cart to update quantity
      await axiosInstance.put(`/api/cart/${item.cartItemId}`, { quantity: item.quantity - 1 })
      
      // Update local state quantity
      dispatch(decreaseCartItem(productId))
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout()
      }
    }
  }

  const handleIncreaseQuantity = async (product) => {
    // Simply leverage our existing handleAddToCart function
    await handleAddToCart(product)
  }

  const getCartTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }

  const getCartTotalPrice = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)
  }

  const categories = ["All", ...new Set(products.map(p => p.category))]

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-900">
      
      {/* Top Banner Message */}
      {error && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-center py-2.5 px-4 text-sm flex items-center justify-center gap-2">
          <svg className="w-5 h-5 animate-pulse text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 min-h-[72px] sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0" onClick={() => setCurrentView("catalog")}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-emerald-500/20">
              A
            </div>
            <span className="font-extrabold text-xl sm:text-2xl tracking-wider bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              AURA
            </span>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => setCurrentView("catalog")}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                currentView === "catalog"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Home
              </span>
            </button>
          </nav>

          {/* Search Bar */}
          <div className="flex-1 max-w-lg relative group hidden md:block">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-400 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search premium products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
            />
          </div>

          {/* User & Cart Navigation */}
          <div className="flex items-center gap-2 sm:gap-4">

            {/* Auth / User Button */}
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer shrink-0"
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar.startsWith("/uploads") ? API_BASE + user.avatar : user.avatar}
                      alt="avatar"
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shadow-md shadow-emerald-500/20"
                      onError={(e) => { e.currentTarget.style.display = "none" }}
                    />
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 text-xs sm:text-sm shadow-md shadow-emerald-500/20">
                      {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block min-w-0 text-left max-w-[120px] md:max-w-none">
                    <p className="text-xs font-semibold text-slate-200 truncate">{user.name || "Customer"}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 transition-transform ${profileMenuOpen ? 'rotate-180' : ''} hidden sm:block`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {profileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[260px] sm:w-56 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl shadow-black/50 overflow-hidden z-50 animate-scale-in origin-top-right">
                    <div className="py-1">
                      <button
                        onClick={() => { setProfileMenuOpen(false); requireAuth(() => setCurrentView("profile")); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        My Profile
                      </button>
                      <button
                        onClick={() => { setProfileMenuOpen(false); handleOpenOrders(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        My Orders
                      </button>
                    </div>
                    <div className="py-1 border-t border-slate-800">
                      <button
                        onClick={() => { setProfileMenuOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => { setAuthMode("login"); setAuthModalOpen(true); setAuthError(""); setAuthForm({ email: "", password: "", name: "" }); }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-md shadow-emerald-500/15 flex items-center gap-1 sm:gap-1.5"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {/* Cart Icon with badge */}
            <div className="relative group">
              <button 
                className={`p-2 sm:p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/20 transition-all ${isCartAnimating ? 'scale-110 border-emerald-400' : ''}`}
                onClick={() => { if (requireAuth(() => { setCurrentView("cart"); setCheckoutError(""); })); }}
              >
                <svg className="w-5 h-5 sm:w-[22px] sm:h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                
                {getCartTotalItems() > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-slate-950 font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#090d16] animate-scale-in">
                    {getCartTotalItems() > 99 ? "99+" : getCartTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {currentView === "profile" ? (
        /* ========== PROFILE PAGE (Full Page View) ========== */
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-24 flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <button
              onClick={() => { setCurrentView("catalog"); setProfileEditing(false); }}
              className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium cursor-pointer self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Shop
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-wide text-center sm:text-left order-first sm:order-none w-full sm:w-auto">
              My Profile
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5 sm:gap-6 mb-6 sm:mb-8">
            {/* Avatar Column */}
            <div className="glass-panel rounded-2xl border border-slate-800/60 p-5 sm:p-6 flex flex-col items-center text-center h-fit">
              <div className="relative mb-4 group">
                {user?.avatar ? (
                  <img
                    src={user.avatar.startsWith("/uploads") ? API_BASE + user.avatar : user.avatar}
                    alt="avatar"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-xl shadow-emerald-500/10 border-2 border-slate-800"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-3xl sm:text-4xl shadow-xl shadow-emerald-500/10 border-2 border-slate-800">
                    {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <label className="absolute inset-0 rounded-2xl bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer border-2 border-emerald-500/40">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={profileUploading}
                  />
                  {profileUploading ? (
                    <div className="w-6 h-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                  ) : (
                    <svg className="w-6 h-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </label>
              </div>
              <h3 className="font-bold text-white text-lg">{user?.name || "Customer"}</h3>
              <p className="text-xs text-slate-500 mb-1">{user?.email}</p>
              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-2">
                {user?.role || "USER"}
              </span>
              <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
                Click on the photo to upload a new profile picture. JPG, PNG, WEBP up to 5MB.
              </p>
            </div>

            {/* Info Column */}
            <div className="glass-panel rounded-2xl border border-slate-800/60 p-5 sm:p-6 md:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Personal Information</h2>
                  <p className="text-xs text-slate-500 mt-1">Manage your account details and preferences.</p>
                </div>
                {!profileEditing ? (
                  <button
                    onClick={handleStartProfileEdit}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    onClick={() => setProfileEditing(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5 sm:space-y-6">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={profileEditing ? profileForm.name : (user?.name || "")}
                    onChange={handleProfileInputChange}
                    disabled={!profileEditing}
                    placeholder="Your full name"
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/60 border text-sm transition-all ${
                      profileEditing
                        ? "border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                        : "border-transparent text-slate-300 bg-slate-900/30"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/30 border border-transparent text-sm text-slate-400 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-600 mt-1.5 ml-1">Email cannot be changed.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mobile Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileEditing ? profileForm.phone : (user?.phone || "")}
                    onChange={handleProfileInputChange}
                    disabled={!profileEditing}
                    placeholder="+91 98765 43210"
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900/60 border text-sm transition-all ${
                      profileEditing
                        ? "border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                        : "border-transparent text-slate-300 bg-slate-900/30"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Your Gender</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: "Male", label: "Male" },
                      { value: "Female", label: "Female" },
                      { value: "Other", label: "Other" }
                    ].map(opt => {
                      const val = profileEditing ? profileForm.gender : (user?.gender || "")
                      const checked = val === opt.value
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-all ${
                            checked
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                              : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                          } ${!profileEditing ? "pointer-events-none opacity-80" : ""}`}
                        >
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            checked ? "border-emerald-400" : "border-slate-600"
                          }`}>
                            {checked && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                          </span>
                          <input
                            type="radio"
                            name="gender"
                            value={opt.value}
                            checked={checked}
                            onChange={handleProfileInputChange}
                            disabled={!profileEditing}
                            className="hidden"
                          />
                          {opt.label}
                        </label>
                      )
                    })}
                  </div>
                </div>

                {profileEditing && (
                  <div className="pt-4 border-t border-slate-800/60 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setProfileEditing(false)}
                      className="px-5 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="glow-btn px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center gap-2 transition-all"
                    >
                      {profileSaving ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></div>
                          Saving...
                        </>
                      ) : "Save Changes"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* =============== MANAGE ADDRESSES =============== */}
          <div className="glass-panel rounded-2xl border border-slate-800/60 p-5 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Manage Addresses</h2>
                <p className="text-xs text-slate-500 mt-1">Save multiple addresses for faster checkout.</p>
              </div>
            </div>

            {!addressFormOpen && (
              <button
                onClick={() => handleOpenAddressForm(null)}
                className="w-full mb-5 sm:mb-6 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 rounded-xl border-2 border-dashed border-slate-700/60 text-left hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-400 tracking-wide uppercase">ADD A NEW ADDRESS</p>
                </div>
              </button>
            )}

            {addressFormOpen && (
              <div className="mb-5 sm:mb-6 p-5 sm:p-6 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wide">
                    {editingAddressId ? "EDIT ADDRESS" : "ADD A NEW ADDRESS"}
                  </h3>
                </div>

                <div className="mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          () => {},
                          () => {},
                          { timeout: 3000 }
                        )
                      }
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white text-sm font-bold shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Use my current location
                  </button>
                </div>

                <form onSubmit={handleSaveAddress} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Name</label>
                      <input
                        type="text"
                        name="name"
                        value={addressForm.name}
                        onChange={handleAddressInputChange}
                        placeholder="Full name"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">10-digit mobile number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={addressForm.phone}
                        onChange={handleAddressInputChange}
                        placeholder="98765 43210"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pincode</label>
                      <input
                        type="text"
                        name="pincode"
                        value={addressForm.pincode}
                        onChange={handleAddressInputChange}
                        placeholder="682020"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Locality</label>
                      <input
                        type="text"
                        name="locality"
                        value={addressForm.locality}
                        onChange={handleAddressInputChange}
                        placeholder="Kadavanthra"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Address (Area and Street)</label>
                    <textarea
                      name="address"
                      rows="3"
                      value={addressForm.address}
                      onChange={handleAddressInputChange}
                      placeholder="Design Faktory, Giri Nagar, KP Vallon Road"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">City/District/Town</label>
                      <input
                        type="text"
                        name="city"
                        value={addressForm.city}
                        onChange={handleAddressInputChange}
                        placeholder="Kochi, Ernakulam"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">State</label>
                      <select
                        name="state"
                        value={addressForm.state}
                        onChange={handleAddressInputChange}
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      >
                        <option value="">--Select State--</option>
                        {INDIAN_STATES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Landmark (Optional)</label>
                      <input
                        type="text"
                        name="landmark"
                        value={addressForm.landmark}
                        onChange={handleAddressInputChange}
                        placeholder="Near Metro Station"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Alternate Phone (Optional)</label>
                      <input
                        type="tel"
                        name="altPhone"
                        value={addressForm.altPhone}
                        onChange={handleAddressInputChange}
                        placeholder="0484 123 4567"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Address Type</label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { value: "Home", label: "Home" },
                        { value: "Work", label: "Work" }
                      ].map(opt => {
                        const checked = addressForm.addressType === opt.value
                        return (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-all ${
                              checked
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              checked ? "border-emerald-400" : "border-slate-600"
                            }`}>
                              {checked && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                            </span>
                            <input
                              type="radio"
                              name="addressType"
                              value={opt.value}
                              checked={checked}
                              onChange={handleAddressInputChange}
                              className="hidden"
                            />
                            {opt.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-300">
                      <input
                        type="checkbox"
                        name="isDefault"
                        checked={addressForm.isDefault}
                        onChange={handleAddressInputChange}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500/30"
                      />
                      <span>Make this my default address</span>
                    </label>
                  </div>

                  <div className="pt-4 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={addressSubmitting}
                      className="px-10 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 disabled:opacity-50 text-white font-black text-sm shadow-lg shadow-blue-500/15 cursor-pointer flex items-center gap-2 transition-all"
                    >
                      {addressSubmitting ? "Saving..." : "SAVE"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseAddressForm}
                      className="px-5 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      CANCEL
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Address Cards List */}
            <div className="space-y-4">
              {addressLoading ? (
                <div className="py-10 text-center text-slate-500 text-sm">Loading addresses...</div>
              ) : addresses.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-slate-400 text-sm">No saved addresses yet.</p>
                  <p className="text-slate-600 text-xs mt-1">Add your first address above for a faster checkout.</p>
                </div>
              ) : (
                addresses.map(addr => (
                  <div key={addr.id} className="relative p-5 rounded-xl border border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 hover:border-slate-700 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h4 className="font-bold text-white text-base">{addr.name}</h4>
                          <span className="text-slate-400 font-semibold">{addr.phone}</span>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Default
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            addr.addressType === "Home"
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {addr.addressType || "Home"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {[addr.address, addr.locality, addr.city, addr.state].filter(Boolean).join(", ")}
                          {addr.pincode && <> - <span className="font-semibold text-slate-200">{addr.pincode}</span></>}
                        </p>
                        {addr.landmark && (
                          <p className="text-xs text-slate-500 mt-1.5"><span className="text-slate-600">Landmark:</span> {addr.landmark}</p>
                        )}
                        {addr.altPhone && (
                          <p className="text-xs text-slate-500 mt-1"><span className="text-slate-600">Alt:</span> {addr.altPhone}</p>
                        )}
                      </div>

                      <div className="relative" ref={openAddressMenuId === addr.id ? addressMenuRef : null}>
                        <button
                          onClick={() => setOpenAddressMenuId(openAddressMenuId === addr.id ? null : addr.id)}
                          className="address-menu-btn p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.75" />
                            <circle cx="12" cy="12" r="1.75" />
                            <circle cx="12" cy="19" r="1.75" />
                          </svg>
                        </button>

                        {openAddressMenuId === addr.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/50 overflow-hidden z-30 animate-scale-in origin-top-right">
                            {!addr.isDefault && (
                              <button
                                onClick={() => handleSetDefaultAddress(addr.id)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer"
                              >
                                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Set as Default
                              </button>
                            )}
                            <button
                              onClick={() => { setOpenAddressMenuId(null); handleOpenAddressForm(addr); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border-t border-slate-800"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      ) : currentView === "cart" ? (
        /* ========== CART PAGE (Full Page View) ========== */
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-24 flex-1 w-full">
          {/* Breadcrumb / Back */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <button
              onClick={() => { setCurrentView("catalog"); setCheckoutStep("cart"); }}
              className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 transition-colors text-sm font-medium cursor-pointer self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Continue Shopping
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-wide text-center sm:text-left order-first sm:order-none mx-auto sm:mx-0">
              My Cart <span className="text-slate-500 text-base font-semibold">({getCartTotalItems()} items)</span>
            </h1>
          </div>

          {cart.length === 0 ? (
            /* Empty Cart State */
            <div className="glass-panel rounded-2xl py-20 px-6 text-center border border-slate-800/60 max-w-xl mx-auto">
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-5 text-slate-500">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl text-white mb-2">Your cart is empty</h3>
              <p className="text-slate-400 text-sm mb-6">
                Explore the catalog and add premium gear to your cart to get started.
              </p>
              <button
                onClick={() => setCurrentView("catalog")}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/15 cursor-pointer transition-all"
              >
                Browse Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start">
              {/* =============== LEFT COLUMN: Cart Items & Address =============== */}
              <div className="lg:col-span-2 space-y-5 sm:space-y-6">

                {/* Step 1: Cart Items */}
                {checkoutStep === "cart" && (
                  <div className="glass-panel rounded-2xl border border-slate-800/60 overflow-hidden">
                    <div className="p-5 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/30">
                      <h2 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-black">1</span>
                        Cart Items ({cart.length})
                      </h2>
                    </div>
                    <div className="divide-y divide-slate-800/60">
                      {cart.map((item) => {
                        const subtotal = item.price * item.quantity
                        const product = products.find(p => p.id === item.id)
                        return (
                          <div key={item.id} className="p-5 flex gap-5 hover:bg-slate-900/20 transition-colors">
                            {/* Product Image */}
                            <div className="w-28 h-28 rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800 shrink-0">
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            </div>

                            {/* Product Info */}
                            <div className="flex-1 min-w-0 flex flex-col">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 pr-3">
                                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                                    {product?.category || "Category"}
                                  </span>
                                  <h3 className="font-bold text-white text-base mt-0.5 line-clamp-2">{item.name}</h3>
                                  <p className="text-xs text-slate-500 mt-1">SKU: PRD-{String(item.id).padStart(5, "0")}</p>
                                </div>
                                <button
                                  onClick={() => handleRemoveFromCart(item.id)}
                                  className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-950/20 cursor-pointer shrink-0"
                                  title="Remove"
                                >
                                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>

                              {/* Price + Quantity Row */}
                              <div className="flex items-center justify-between mt-auto pt-4">
                                <div className="flex items-baseline gap-2">
                                  <span className="font-extrabold text-xl text-white">₹{item.price.toFixed(2)}</span>
                                  <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                                    {item.quantity > 1 ? `${item.quantity} pcs` : ""}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  {/* Quantity Controls */}
                                  <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                    <button
                                      onClick={() => handleDecreaseQuantity(item.id)}
                                      className="w-9 h-9 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors cursor-pointer flex items-center justify-center"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                                      </svg>
                                    </button>
                                    <span className="w-10 text-center font-bold text-slate-200 text-sm">{item.quantity}</span>
                                    <button
                                      onClick={() => handleIncreaseQuantity(item)}
                                      className="w-9 h-9 text-slate-400 hover:text-slate-100 hover:bg-slate-900 transition-colors cursor-pointer flex items-center justify-center"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                      </svg>
                                    </button>
                                  </div>
                                  <span className="font-extrabold text-lg text-emerald-400 min-w-[80px] text-right">
                                    ₹{subtotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2: Shipping / Customer Details */}
                {checkoutStep === "shipping" && (
                  <div className="glass-panel rounded-2xl border border-slate-800/60 overflow-hidden">
                    <div className="p-5 border-b border-slate-800/60 flex items-center justify-between bg-slate-900/30">
                      <h2 className="font-bold text-lg text-white flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-black">2</span>
                        Customer & Shipping Details
                      </h2>
                      <button
                        onClick={() => setCheckoutStep("cart")}
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        ← Edit Cart
                      </button>
                    </div>

                    <div className="p-6 space-y-5">
                      {checkoutError && (
                        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium">
                          {checkoutError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                          <input
                            type="text"
                            name="name"
                            value={customerDetails.name}
                            onChange={handleCustomerChange}
                            placeholder="John Doe"
                            className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number *</label>
                          <input
                            type="tel"
                            name="phone"
                            value={customerDetails.phone}
                            onChange={handleCustomerChange}
                            placeholder="+91 98765 43210"
                            className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
                        <input
                          type="email"
                          name="email"
                          value={customerDetails.email}
                          onChange={handleCustomerChange}
                          placeholder="john@example.com"
                          className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                        />
                      </div>

                      {/* ============ SAVED ADDRESSES SECTION ============ */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shipping Address *</label>
                          <button
                            type="button"
                            onClick={() => {
                              const toggled = !manualAddressEntry
                              setManualAddressEntry(toggled)
                              if (toggled) {
                                setSelectedAddressId(null)
                              } else {
                                const defaultAddr = addresses.find(a => a.isDefault) || addresses[0]
                                if (defaultAddr) {
                                  handleSelectAddress(defaultAddr)
                                }
                              }
                            }}
                            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          >
                            {manualAddressEntry ? "← Use Saved Address" : "+ Enter Manually"}
                          </button>
                        </div>

                        {!manualAddressEntry && (
                          <div className="space-y-3">
                            {addressLoading ? (
                              <div className="py-8 text-center text-slate-500 text-sm">Loading addresses...</div>
                            ) : addresses.length === 0 ? (
                              <div className="p-5 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/20 text-center">
                                <p className="text-slate-400 text-sm mb-1">No saved addresses yet.</p>
                                <p className="text-slate-600 text-xs mb-4">Save your address for a faster checkout next time.</p>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                {addresses.map(addr => {
                                  const isSelected = selectedAddressId === addr.id
                                  return (
                                    <label
                                      key={addr.id}
                                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                        isSelected
                                          ? "bg-emerald-500/5 border-emerald-500/40 ring-1 ring-emerald-500/20"
                                          : "bg-slate-900/30 border-slate-800 hover:bg-slate-900/50 hover:border-slate-700"
                                      }`}
                                    >
                                      <div className="pt-0.5 shrink-0">
                                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                          isSelected ? "border-emerald-400" : "border-slate-600"
                                        }`}>
                                          {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>}
                                        </span>
                                        <input
                                          type="radio"
                                          name="savedAddress"
                                          checked={isSelected}
                                          onChange={() => handleSelectAddress(addr)}
                                          className="hidden"
                                        />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                          <h4 className="font-bold text-white text-sm">{addr.name}</h4>
                                          <span className="text-slate-500 text-xs font-semibold">{addr.phone}</span>
                                          {addr.isDefault && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                              Default
                                            </span>
                                          )}
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                            addr.addressType === "Home"
                                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                          }`}>
                                            {addr.addressType || "Home"}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed">
                                          {[addr.address, addr.locality, addr.city, addr.state].filter(Boolean).join(", ")}
                                          {addr.pincode && <> - <span className="font-semibold text-slate-300">{addr.pincode}</span></>}
                                        </p>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            )}

                            {!checkoutAddressFormOpen && (
                              <button
                                type="button"
                                onClick={handleOpenCheckoutAddressForm}
                                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 border-dashed border-slate-800 text-left hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer group"
                              >
                                <div className="w-8 h-8 rounded-lg bg-slate-900/60 text-slate-500 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-300 group-hover:text-emerald-400 transition-colors uppercase tracking-wide">
                                    {addresses.length === 0 ? "Add a New Address" : "Add Another Address"}
                                  </p>
                                </div>
                              </button>
                            )}

                            {checkoutAddressFormOpen && (
                              <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wide">
                                    {editingAddressId ? "EDIT ADDRESS" : "ADD A NEW ADDRESS"}
                                  </h3>
                                </div>
                                <form onSubmit={handleSaveCheckoutAddress} className="space-y-3.5">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
                                      <input type="text" name="name" value={addressForm.name} onChange={handleAddressInputChange}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mobile</label>
                                      <input type="tel" name="phone" value={addressForm.phone} onChange={handleAddressInputChange}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm" />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pincode</label>
                                      <input type="text" name="pincode" value={addressForm.pincode} onChange={handleAddressInputChange}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Locality</label>
                                      <input type="text" name="locality" value={addressForm.locality} onChange={handleAddressInputChange}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address (Area and Street)</label>
                                    <textarea name="address" rows="2" value={addressForm.address} onChange={handleAddressInputChange}
                                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm resize-none" />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                                      <input type="text" name="city" value={addressForm.city} onChange={handleAddressInputChange}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm" />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">State</label>
                                      <select name="state" value={addressForm.state} onChange={handleAddressInputChange}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm">
                                        <option value="">--Select State--</option>
                                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                                        <input type="checkbox" name="isDefault" checked={addressForm.isDefault} onChange={handleAddressInputChange}
                                          className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500/30" />
                                        Make this my default address
                                      </label>
                                    </div>
                                  </div>
                                  <div className="pt-2 flex items-center gap-3">
                                    <button type="submit" disabled={addressSubmitting}
                                      className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/15 cursor-pointer transition-all">
                                      {addressSubmitting ? "Saving..." : "SAVE & USE"}
                                    </button>
                                    <button type="button" onClick={handleCloseCheckoutAddressForm}
                                      className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors cursor-pointer">
                                      CANCEL
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}
                          </div>
                        )}

                        {manualAddressEntry && (
                          <div>
                            <textarea
                              name="shippingAddress"
                              value={customerDetails.shippingAddress}
                              onChange={handleCustomerChange}
                              rows="4"
                              placeholder="123 Main Street, Apt 4B, City Name, State, PIN Code"
                              className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm resize-none"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-start gap-3 pt-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-300">Ready to place your order</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Your details are securely saved with this order. 100% Authentic products, easy returns.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* =============== RIGHT COLUMN: Price Summary =============== */}
              <div className="lg:col-span-1 order-first lg:order-none">
                <div className="glass-panel rounded-2xl border border-slate-800/60 overflow-hidden lg:sticky lg:top-24">
                  <div className="p-4 sm:p-5 border-b border-slate-800/60 bg-slate-900/30">
                    <h3 className="font-bold text-base text-white">Price Details</h3>
                  </div>

                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Price ({getCartTotalItems()} items)</span>
                      <span className="font-semibold text-slate-200">₹{getCartTotalPrice()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Shipping</span>
                      <span className="font-bold text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded">FREE</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Estimated Tax (8%)</span>
                      <span className="font-semibold text-slate-200">₹{(parseFloat(getCartTotalPrice()) * 0.08).toFixed(2)}</span>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent my-1"></div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="font-extrabold text-base sm:text-lg text-white">Total Amount</span>
                      <span className="font-extrabold text-xl sm:text-2xl text-emerald-400">
                        ₹{(parseFloat(getCartTotalPrice()) * 1.08).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                      <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        You save on shipping charges with this order!
                      </p>
                    </div>

                    <div className="pt-4 mt-2 border-t border-slate-800/60 space-y-3">
                      {checkoutStep === "cart" ? (
                        <button
                          onClick={() => { if (requireAuth(() => { setCheckoutStep("shipping"); setCheckoutError(""); window.scrollTo({ top: 0, behavior: "smooth" }); })); }}
                          className="glow-btn w-full py-3.5 sm:py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all"
                        >
                          <span>Place Order</span>
                          <svg className="w-4 h-4 sm:w-[18px] sm:h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleCheckout}
                            disabled={orderSubmitting}
                            className="glow-btn w-full py-3.5 sm:py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm sm:text-base rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 transition-all"
                          >
                            {orderSubmitting ? (
                              <>
                                <div className="w-5 h-5 rounded-full border-2.5 border-slate-950 border-t-transparent animate-spin"></div>
                                <span className="text-sm sm:text-base">Placing Order...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                Place Order
                              </>
                            )}
                          </button>
                          <p className="text-[10px] text-slate-500 text-center font-medium">
                            Your order will be placed immediately
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* ========== CATALOG PAGE ========== */
        <>
          {/* Hero Section */}
          <section className="relative overflow-hidden pt-12 pb-10 px-6">
            <div className="max-w-7xl mx-auto text-center relative z-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide uppercase mb-6 animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Elevated Essentials
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                Experience the Future of <br />
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                  Premium E-Commerce
                </span>
              </h1>
              <p className="max-w-2xl mx-auto text-slate-400 text-base sm:text-lg mb-8 leading-relaxed">
                Curated top-tier gear crafted with clean aesthetics, high durability, and modern workspaces in mind.
              </p>
            </div>

            {/* Ambient Blur Background Glows */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-72 h-72 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none"></div>
            <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
          </section>

          {/* Main Content Catalog */}
          <main className="max-w-7xl mx-auto px-6 pb-24 flex-1 w-full">
        
        {/* Search bar on Mobile */}
        <div className="mb-6 md:hidden">
          <input
            type="text"
            placeholder="Search premium products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Selector Tabs */}
        <div className="flex items-center overflow-x-auto pb-4 mb-10 gap-2.5 no-scrollbar scroll-smooth">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 cursor-pointer ${
                selectedCategory === category
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/15 font-semibold"
                  : "bg-slate-900/50 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin"></div>
            <p className="text-slate-400 animate-pulse text-sm">Fetching catalog...</p>
          </div>
        )}

        {/* Empty Catalog State */}
        {!loading && filteredProducts.length === 0 && (
          <div className="glass-panel rounded-2xl py-16 px-6 text-center border border-slate-800/60 max-w-xl mx-auto">
            <svg className="w-14 h-14 text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
            <h3 className="font-semibold text-lg text-slate-200 mb-1">No products found</h3>
            <p className="text-slate-400 text-sm">
              We couldn't find any products matching your search "{searchQuery}" or category.
            </p>
            <button 
              onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
              className="mt-5 px-4.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Product Cards Grid */}
        {!loading && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => (
              <div 
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col group"
              >
                
                {/* Image Container with Hover Scale */}
                <div className="relative aspect-video w-full overflow-hidden bg-slate-900 flex items-center justify-center border-b border-slate-800/50">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-emerald-400 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border border-emerald-500/10">
                    {product.category}
                  </div>
                  
                  {/* Edit and Delete Actions Hidden for Public Customer */}
                </div>

                {/* Card Details */}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <span className="font-bold text-lg text-emerald-400 whitespace-nowrap">
                      ₹{product.price.toFixed(2)}
                    </span>
                  </div>

                  <p className="text-slate-400 text-sm line-clamp-2 mb-5 leading-relaxed">
                    {product.description}
                  </p>

                  <div className="mt-auto pt-4 border-t border-slate-800/40 flex items-center justify-between">
                    {/* Stock Status Indicator */}
                    <span className="text-[11px] font-medium flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${product.stock <= 5 ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`}></span>
                      {product.stock <= 5 ? `Only ${product.stock} left!` : "In stock"}
                    </span>

                    {/* Interactive Button */}
                    <button 
                      onClick={(e) => handleAddToCart(product, e)}
                      className="glow-btn px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Add to Cart
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </main>
        </>
      )}

      {/* Footer */}
      <footer className="glass-panel border-t border-slate-800/80 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
          <p>© 2026 Aura E-Commerce Systems Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-emerald-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-emerald-400 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>

      {/* Login / Register Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in" onClick={() => setAuthModalOpen(false)}>
          <div 
            className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden animate-scale-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-emerald-500/20">
                  A
                </div>
                <div>
                  <h2 className="font-extrabold text-xl text-white tracking-wide">
                    {authMode === "login" ? "Welcome Back" : authMode === "register" ? "Create Account" : authMode === "forgot" ? "Reset Your Password" : "Choose a New Password"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {authMode === "login" ? "Sign in to your Aura account" : authMode === "register" ? "Join Aura for a personalized experience" : "Secure access to your Aura account"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 hover:text-white text-slate-400 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAuthSubmit} className="p-6 space-y-5">
              {authError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium">
                  {authError}
                </div>
              )}

              {resetMessage && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs font-medium">
                  {resetMessage}
                  {resetUrl && <a href={resetUrl} className="block mt-2 text-emerald-400 underline break-all">Open reset link</a>}
                </div>
              )}

              {authMode === "register" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                  <input 
                    type="text" 
                    name="name"
                    value={authForm.name}
                    onChange={handleAuthInputChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                  />
                </div>
              )}

              {authMode !== "reset" && <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email Address *</label>
                <input 
                  type="email" 
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthInputChange}
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
              </div>}

              {(authMode === "login" || authMode === "register") && <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password"
                    value={authForm.password}
                    onChange={handleAuthInputChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>}

              {authMode === "forgot" && (
                <p className="text-xs text-slate-400 leading-relaxed">Enter your account email and we will create a secure password reset link.</p>
              )}

              {authMode === "reset" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Password *</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      name="newPassword"
                      value={authForm.newPassword}
                      onChange={handleAuthInputChange}
                      placeholder="At least 8 characters"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showNewPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button 
                type="submit"
                disabled={authSubmitting}
                className="glow-btn w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                {authSubmitting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></div>
                    {authMode === "login" ? "Signing in..." : authMode === "register" ? "Creating account..." : authMode === "forgot" ? "Creating reset link..." : "Updating password..."}
                  </>
                ) : (
                  authMode === "login" ? "Sign In to Aura" : authMode === "register" ? "Create My Account" : authMode === "forgot" ? "Send Reset Link" : "Reset Password"
                )}
              </button>

              {authMode !== "reset" && <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-slate-800"></div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-800"></div>
              </div>}

              {authMode === "login" && (
                <button
                  type="button"
                  onClick={() => { setAuthMode("forgot"); setAuthError(""); setResetMessage(""); setResetUrl("") }}
                  className="w-full text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors cursor-pointer"
                >
                  Forgot your password?
                </button>
              )}

              {authMode !== "reset" && <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" || authMode === "forgot" ? "register" : "login")
                  setAuthError("")
                  setResetMessage("")
                  setResetUrl("")
                  setAuthForm({ email: authForm.email, password: "", name: "", newPassword: "" })
                }}
                className="w-full py-3 rounded-xl border border-slate-800 bg-slate-900/30 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all cursor-pointer"
              >
                {authMode === "login" || authMode === "forgot" ? (
                  <>New to Aura? <span className="text-emerald-400 font-bold">Create an account</span></>
                ) : (
                  <>Already have an account? <span className="text-emerald-400 font-bold">Sign in</span></>
                )}
              </button>}
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}>
          
          <div 
            className="w-full max-w-3xl glass-panel rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/50 overflow-hidden animate-scale-in flex flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image */}
            <div className="md:w-1/2 relative bg-slate-900 aspect-video md:aspect-auto flex items-center justify-center">
              <img 
                src={selectedProduct.imageUrl} 
                alt={selectedProduct.name} 
                className="w-full h-full object-cover" 
              />
              <span className="absolute top-4 left-4 bg-slate-950/90 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-500/10">
                {selectedProduct.category}
              </span>
            </div>

            {/* Modal Description */}
            <div className="p-8 md:w-1/2 flex flex-col">
              
              {/* Close Button */}
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h2 className="font-extrabold text-2xl text-white leading-snug">{selectedProduct.name}</h2>
                  <p className="text-emerald-400 font-bold text-xl mt-1">₹{selectedProduct.price.toFixed(2)}</p>
                </div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-400 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-slate-300 text-sm leading-relaxed mb-6 flex-1 mt-2">
                {selectedProduct.description}
              </p>

              {/* Add to Cart button inside details */}
              <div className="mt-auto pt-6 border-t border-slate-800/60 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">
                    Stock availability: <strong className="text-emerald-400">{selectedProduct.stock} items</strong>
                  </span>
                  
                  {/* Edit and Delete Actions Hidden for Public Customer */}
                </div>

                <button 
                  onClick={(e) => {
                    handleAddToCart(selectedProduct, e);
                    setSelectedProduct(null);
                  }}
                  className="glow-btn w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Add to Shopping Cart
                </button>
              </div>

            </div>
          </div>
          
        </div>
      )}

      {/* Add Product Form Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in" onClick={() => setIsAddModalOpen(false)}>
          
          <div 
            className="w-full max-w-lg glass-panel rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden animate-scale-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/30">
              <h2 className="font-extrabold text-xl text-white tracking-wide">Add New Product</h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 hover:text-white text-slate-400 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleAddProductSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {formError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Product Name *</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  value={newProduct.name}
                  onChange={handleInputChange}
                  placeholder="e.g. AeroSound Wireless Pro"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
              </div>

              {/* Price & Stock Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                  <input 
                    type="number" 
                    name="price"
                    required
                    step="0.01"
                    min="0"
                    value={newProduct.price}
                    onChange={handleInputChange}
                    placeholder="299.99"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Initial Stock</label>
                  <input 
                    type="number" 
                    name="stock"
                    min="0"
                    value={newProduct.stock}
                    onChange={handleInputChange}
                    placeholder="10"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category *</label>
                <select 
                  name="category"
                  value={newProduct.category}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Wearables">Wearables</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Image URL</label>
                <input 
                  type="text" 
                  name="imageUrl"
                  value={newProduct.imageUrl}
                  onChange={handleInputChange}
                  placeholder="https://images.unsplash.com/... (optional)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description *</label>
                <textarea 
                  name="description"
                  required
                  rows="3"
                  value={newProduct.description}
                  onChange={handleInputChange}
                  placeholder="Tell us about the premium features..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-800/60 flex items-center justify-end gap-3 bg-slate-900/10">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4.5 py-2.5 rounded-xl border border-slate-850 bg-slate-900/30 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-sm font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={formSubmitting}
                  className="glow-btn px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 text-sm font-extrabold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5"
                >
                  {formSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></div>
                      Adding...
                    </>
                  ) : "Create Product"}
                </button>
              </div>

            </form>
          </div>
          
        </div>
      )}

      {/* Edit Product Form Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in" onClick={() => setEditingProduct(null)}>
          
          <div 
            className="w-full max-w-lg glass-panel rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden animate-scale-in flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/30">
              <h2 className="font-extrabold text-xl text-white tracking-wide">Edit Product Details</h2>
              <button 
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 hover:text-white text-slate-400 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleEditProductSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {editFormError && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs font-medium">
                  {editFormError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Product Name *</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  value={editingProduct.name}
                  onChange={handleEditInputChange}
                  placeholder="e.g. AeroSound Wireless Pro"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
              </div>

              {/* Price & Stock Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                  <input 
                    type="number" 
                    name="price"
                    required
                    step="0.01"
                    min="0"
                    value={editingProduct.price}
                    onChange={handleEditInputChange}
                    placeholder="299.99"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Initial Stock</label>
                  <input 
                    type="number" 
                    name="stock"
                    min="0"
                    value={editingProduct.stock}
                    onChange={handleEditInputChange}
                    placeholder="10"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Category *</label>
                <select 
                  name="category"
                  value={editingProduct.category}
                  onChange={handleEditInputChange}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Wearables">Wearables</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Image URL</label>
                <input 
                  type="text" 
                  name="imageUrl"
                  value={editingProduct.imageUrl || ""}
                  onChange={handleEditInputChange}
                  placeholder="https://images.unsplash.com/... (optional)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Description *</label>
                <textarea 
                  name="description"
                  required
                  rows="3"
                  value={editingProduct.description}
                  onChange={handleEditInputChange}
                  placeholder="Tell us about the premium features..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-800/60 flex items-center justify-end gap-3 bg-slate-900/10">
                <button 
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4.5 py-2.5 rounded-xl border border-slate-850 bg-slate-900/30 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-sm font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={editSubmitting}
                  className="glow-btn px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 text-sm font-extrabold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center gap-1.5"
                >
                  {editSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></div>
                      Saving...
                    </>
                  ) : "Save Changes"}
                </button>
              </div>

            </form>
          </div>
          
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" onClick={() => setDeletingProductId(null)}>
          <div 
            className="w-full max-w-sm glass-panel rounded-2xl border border-slate-700/50 p-6 shadow-2xl animate-scale-in text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/25">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2">Delete Product?</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Are you sure you want to delete this product permanently from the database? This action cannot be undone.
            </p>

            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900/30 text-slate-400 hover:text-slate-200 text-sm font-medium transition-all cursor-pointer flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteProduct}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer flex-1 shadow-lg shadow-rose-900/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Result Modal */}
      {paymentResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/50 p-8 shadow-2xl animate-scale-in text-center"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-result-title"
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border ${
              paymentResult.type === "accepted"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                : "bg-rose-500/10 text-rose-400 border-rose-500/25"
            }`}>
              {paymentResult.type === "accepted" ? (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            <h2 id="payment-result-title" className="text-2xl font-extrabold text-white mb-2">
              {paymentResult.type === "accepted" ? "Payment Accepted" : "Payment Declined"}
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {paymentResult.type === "accepted"
                ? `Your payment of ₹${parseFloat(paymentResult.order.amount).toFixed(2)} was verified successfully.`
                : paymentResult.message}
            </p>

            <button
              onClick={() => setPaymentResult(null)}
              className={`w-full py-3 rounded-xl text-sm font-bold cursor-pointer transition-all ${
                paymentResult.type === "accepted"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                  : "bg-rose-500 hover:bg-rose-400 text-white"
              }`}
            >
              {paymentResult.type === "accepted" ? "View Order" : "Return to Checkout"}
            </button>
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {successfulOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in" onClick={() => setSuccessfulOrder(null)}>
          <div
            className="w-full max-w-md glass-panel rounded-2xl border border-slate-700/50 p-8 shadow-2xl animate-scale-in text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-5 border border-emerald-500/25">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-extrabold text-white mb-2">Order Placed Successfully!</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Your order <span className="font-bold text-emerald-400">#{successfulOrder.id}</span> has been placed successfully.
              Thank you for shopping with Aura!
            </p>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/60 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Amount</span>
                <span className="font-bold text-emerald-400">₹{parseFloat(successfulOrder.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Items Ordered</span>
                <span className="font-semibold text-slate-200">{successfulOrder.items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Status</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  {successfulOrder.status}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
              {successfulOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs p-2 rounded-lg bg-slate-900/30">
                  <span className="text-slate-300 truncate flex-1 pr-2">{item.quantity}x {item.name}</span>
                  <span className="text-emerald-400 font-semibold">₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const orderRecord = orders.find(o => o.id === successfulOrder.id) || successfulOrder
                  setInvoiceOrder({
                    id: successfulOrder.id,
                    createdAt: orderRecord.createdAt || new Date().toISOString(),
                    amount: successfulOrder.amount,
                    currency: orderRecord.currency || "INR",
                    status: successfulOrder.status,
                    customerName: orderRecord.customerName || customerDetails.name || "Valued Customer",
                    customerEmail: orderRecord.customerEmail || customerDetails.email || "",
                    customerPhone: orderRecord.customerPhone || customerDetails.phone || "",
                    shippingAddress: orderRecord.shippingAddress || customerDetails.shippingAddress || "",
                    items: successfulOrder.items.map(i => ({
                      product: { name: i.name, imageUrl: products.find(p => p.id === i.productId)?.imageUrl },
                      quantity: i.quantity,
                      price: i.price,
                      productId: i.productId
                    }))
                  })
                  setSuccessfulOrder(null)
                }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Invoice
              </button>
              <button
                onClick={() => setSuccessfulOrder(null)}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/15 cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Orders Modal */}
      {isOrdersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in" onClick={() => setIsOrdersModalOpen(false)}>
          <div
            className="w-full max-w-3xl glass-panel rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-extrabold text-xl text-white tracking-wide">My Orders</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{orders.length} order{orders.length !== 1 ? "s" : ""} total</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchOrders}
                  disabled={ordersLoading}
                  className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh orders"
                >
                  <svg className={`w-4.5 h-4.5 ${ordersLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsOrdersModalOpen(false)}
                  className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 hover:text-white text-slate-400 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {ordersLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin"></div>
                  <p className="text-slate-400 text-sm animate-pulse">Loading orders...</p>
                </div>
              )}

              {!ordersLoading && orders.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-lg text-slate-200 mb-1">No orders yet</h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto mb-5">Once you complete a purchase, your order history will appear here.</p>
                  <button
                    onClick={() => setIsOrdersModalOpen(false)}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/10"
                  >
                    Start Shopping
                  </button>
                </div>
              )}

              {!ordersLoading && orders.map((order) => {
                const isExpanded = expandedOrderId === order.id
                const orderTotal = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

                return (
                  <div
                    key={order.id}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isExpanded ? "bg-slate-900/50 border-indigo-500/30" : "bg-slate-900/30 border-slate-800/60 hover:border-slate-700"
                    }`}
                  >
                    {/* Order Row */}
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="w-full p-5 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-slate-800/20 transition-colors"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm shrink-0">
                          #{order.id}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-slate-100">Order {order.id}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{formatDate(order.createdAt)}</p>
                          {order.customerName && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{order.customerName} · {order.customerEmail}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="font-extrabold text-base text-emerald-400">₹{parseFloat(order.amount).toFixed(2)}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                        </div>
                        <svg className={`w-4.5 h-4.5 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180 text-indigo-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-800/60 p-5 space-y-5 bg-slate-950/30">
                        {/* Items */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Items ({order.items.length})</p>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/40">
                                <div className="w-10 h-10 rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800 shrink-0">
                                  {item.product?.imageUrl ? (
                                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-xs text-slate-200 truncate">
                                    {item.product?.name || `Product #${item.productId}`}
                                  </p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    Qty: <span className="text-slate-300 font-semibold">{item.quantity}</span>
                                    <span className="mx-1.5 text-slate-700">·</span>
                                    Unit: <span className="text-slate-300">₹{item.price.toFixed(2)}</span>
                                  </p>
                                </div>
                                <p className="font-bold text-xs text-emerald-400 shrink-0">
                                  ₹{(item.price * item.quantity).toFixed(2)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Shipping */}
                        {(order.shippingAddress || order.customerPhone) && (
                          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer & Shipping</p>
                            {order.customerName && (
                              <p className="text-xs text-slate-300"><span className="text-slate-500">Name:</span> <span className="font-semibold">{order.customerName}</span></p>
                            )}
                            {order.customerPhone && (
                              <p className="text-xs text-slate-300"><span className="text-slate-500">Phone:</span> <span className="font-semibold">{order.customerPhone}</span></p>
                            )}
                            {order.shippingAddress && (
                              <p className="text-xs text-slate-300 leading-relaxed"><span className="text-slate-500">Address:</span> {order.shippingAddress}</p>
                            )}
                          </div>
                        )}

                        {/* Summary */}
                        <div className="pt-4 border-t border-slate-800/60 space-y-1.5 text-sm">
                          <div className="flex justify-between text-slate-400">
                            <span>Items Subtotal</span>
                            <span className="font-semibold text-slate-200">₹{orderTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>Tax (8%)</span>
                            <span className="font-semibold text-slate-200">₹{(orderTotal * 0.08).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-base pt-2 border-t border-slate-800/40 text-white font-extrabold">
                            <span>Order Total</span>
                            <span className="text-emerald-400">₹{parseFloat(order.amount).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Invoice Action */}
                        <button
                          onClick={() => setInvoiceOrder(order)}
                          className="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Invoice (PDF / Print)
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Printable Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in no-print" onClick={() => setInvoiceOrder(null)}>
          <div
            className="w-full max-w-3xl flex flex-col max-h-[90vh] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Action Bar (print only hides this) */}
            <div className="flex justify-between items-center mb-4 no-print">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Invoice Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintInvoice}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-900/30"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print / Save as PDF
                </button>
                <button
                  onClick={() => setInvoiceOrder(null)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Invoice Document (shown in print) */}
            <div className="invoice-document flex-1 overflow-y-auto bg-white text-slate-900 rounded-2xl shadow-2xl">
              <div className="p-10 space-y-8">
                {/* Header */}
                <div className="flex justify-between items-start pb-8 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-xl text-white shadow-md shadow-emerald-500/20">
                        A
                      </div>
                      <div>
                        <h1 className="font-black text-2xl tracking-tight text-slate-900">AURA</h1>
                        <p className="text-[11px] text-slate-500 font-semibold tracking-widest uppercase">E-Commerce Systems</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5 mt-3">
                      <p>www.aura-ecom.example.com</p>
                      <p>support@aura-ecom.example.com</p>
                      <p>+91 98765 43210</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="font-black text-3xl text-slate-900 tracking-tight">INVOICE</h2>
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex gap-4 justify-end">
                        <span className="text-slate-500">Invoice #:</span>
                        <span className="font-bold text-slate-900 font-mono">{generateInvoiceNumber(invoiceOrder.id)}</span>
                      </div>
                      <div className="flex gap-4 justify-end">
                        <span className="text-slate-500">Date:</span>
                        <span className="font-semibold text-slate-800">{formatInvoiceDate(invoiceOrder.createdAt)}</span>
                      </div>
                      <div className="flex gap-4 justify-end">
                        <span className="text-slate-500">Order #:</span>
                        <span className="font-bold text-slate-900 font-mono">#{invoiceOrder.id}</span>
                      </div>
                      <div className="flex gap-4 justify-end pt-1 mt-2 border-t border-slate-100">
                        <span className="text-slate-500">Status:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          invoiceOrder.status === "CANCELLED" ? "bg-rose-100 text-rose-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {invoiceOrder.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bill To + Ship To */}
                <div className="grid grid-cols-2 gap-10 pb-6 border-b border-slate-200">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Bill To</p>
                    <p className="font-bold text-slate-900">{invoiceOrder.customerName || "Valued Customer"}</p>
                    {invoiceOrder.customerEmail && <p className="text-xs text-slate-600 mt-0.5">{invoiceOrder.customerEmail}</p>}
                    {invoiceOrder.customerPhone && <p className="text-xs text-slate-600 mt-0.5">{invoiceOrder.customerPhone}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Ship To</p>
                    <p className="font-bold text-slate-900">{invoiceOrder.customerName || "Valued Customer"}</p>
                    <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line leading-relaxed">
                      {invoiceOrder.shippingAddress || "Pickup from store"}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Order Items ({invoiceOrder.items.length})</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
                        <th className="text-left py-3 font-black">Product</th>
                        <th className="text-center py-3 font-black w-16">Qty</th>
                        <th className="text-right py-3 font-black w-24">Unit Price</th>
                        <th className="text-right py-3 font-black w-28">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const orderTotal = invoiceOrder.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
                        return (
                          <>
                            {invoiceOrder.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-100">
                                <td className="py-3.5 pr-4">
                                  <p className="font-bold text-slate-900 text-sm">
                                    {item.product?.name || `Product #${item.productId}`}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">SKU: PRD-{String(item.productId).padStart(5, "0")}</p>
                                </td>
                                <td className="text-center py-3.5 font-semibold text-slate-700">{item.quantity}</td>
                                    <td className="text-right py-3.5 font-semibold text-slate-700">₹{item.price.toFixed(2)}</td>
                                    <td className="text-right py-3.5 font-black text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                              </tr>
                            ))}
                            <tr>
                              <td colSpan={4} className="pt-5">
                                <div className="ml-auto space-y-1.5 w-64">
                                  <div className="flex justify-between text-xs py-0.5">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-semibold text-slate-800">₹{orderTotal.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs py-0.5">
                                    <span className="text-slate-500">Tax (8%)</span>
                                    <span className="font-semibold text-slate-800">₹{(orderTotal * 0.08).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between pt-3 mt-2 border-t-2 border-slate-900 text-base py-1">
                                    <span className="font-black uppercase tracking-tight text-slate-900">Total</span>
                                    <span className="font-black text-emerald-600 text-xl">₹{parseFloat(invoiceOrder.amount).toFixed(2)}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Order Notes */}
                <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Order Details</p>
                    <p className="text-xs text-slate-600">Order #{invoiceOrder.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Terms & Notes</p>
                    <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                      <li>Goods once sold cannot be refunded unless damaged.</li>
                      <li>Shipping within 5-7 business days via registered courier.</li>
                      <li>Warranty as per manufacturer's policy.</li>
                    </ul>
                  </div>
                </div>

                {/* Footer Signature */}
                <div className="pt-8 mt-8 border-t border-slate-200 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Authorized Signatory</p>
                    <div className="w-40 h-12 border-b-2 border-slate-300 mb-1"></div>
                    <p className="text-[10px] text-slate-400">For Aura E-Commerce Systems Inc.</p>
                  </div>
                  <div className="text-right">
                    <div className="inline-block px-3 py-1.5 rounded-lg bg-emerald-50 border-2 border-emerald-500/30 rotate-2">
                      <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Order Placed</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-4 italic">Thank you for your business!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App