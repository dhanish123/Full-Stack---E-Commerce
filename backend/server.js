require("dotenv").config()
const express = require("express")
const cors = require("cors")
const prisma = require("./config/db")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const crypto = require("crypto")
const Razorpay = require("razorpay")
const nodemailer = require("nodemailer")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

const JWT_SECRET = process.env.JWT_SECRET || "supersecretauraecommercekey"
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
})
const mailTransporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    })
  : null

const app = express()

const UPLOAD_DIR = path.join(__dirname, "uploads")
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}
app.use("/uploads", express.static(UPLOAD_DIR))

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase()
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`)
  }
})
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/
    const ok = allowed.test(path.extname(file.originalname || "").toLowerCase())
      && allowed.test((file.mimetype || "").toLowerCase())
    cb(ok ? null : new Error("Only JPG, PNG, WEBP, GIF images up to 5MB are allowed"), ok)
  }
})

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Authentication Middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader) {
    const token = authHeader.split(" ")[1]
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" })
      }
      req.user = user
      next()
    })
  } else {
    res.status(401).json({ error: "Authorization header required" })
  }
}

// Admin Role Middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" })
  }
  next()
}

app.get("/", (req, res) => {
  res.send("API Running")
})

// Authentication Routes
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" })
  }
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "USER"
      }
    })
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" })
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to register user" })
  }
})

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" })
  }
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" })
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" })
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to login" })
  }
})

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : ""
  const response = { message: "If an account exists for that email, a password reset link has been created." }

  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.json(response)
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
    const rawToken = crypto.randomBytes(32).toString("hex")
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        userId: user.id
      }
    })

    const resetUrl = `${process.env.CUSTOMER_URL || "http://localhost:5173"}/?resetToken=${rawToken}`
    if (mailTransporter) {
      await mailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: "Reset your Aura password",
        text: `Use this link to reset your Aura password. It expires in 60 minutes: ${resetUrl}`
      })
    } else if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Password reset email is not configured" })
    } else {
      response.resetUrl = resetUrl
    }

    return res.json(response)
  } catch (error) {
    return res.status(500).json({ error: "Failed to create password reset request" })
  }
})

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) {
    return res.status(400).json({ error: "Reset token and new password are required" })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" })
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
    if (!resetToken || resetToken.expiresAt <= new Date()) {
      return res.status(400).json({ error: "This reset link is invalid or expired" })
    }

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: await bcrypt.hash(password, 10) }
    })
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
    return res.json({ message: "Password reset successfully. You can now sign in." })
  } catch (error) {
    return res.status(500).json({ error: "Failed to reset password" })
  }
})

app.get("/api/auth/me", authenticateJWT, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    })
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      gender: user.gender
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user context" })
  }
})

app.patch("/api/user/profile", authenticateJWT, async (req, res) => {
  const allowed = {}
  if (typeof req.body.name === "string") allowed.name = req.body.name.trim() || null
  if (typeof req.body.phone === "string") allowed.phone = req.body.phone.trim() || null
  if (typeof req.body.gender === "string" && ["Male", "Female", "Other"].includes(req.body.gender)) allowed.gender = req.body.gender
  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: allowed,
      select: { id: true, email: true, name: true, role: true, phone: true, avatar: true, gender: true }
    })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" })
  }
})

app.post("/api/user/avatar", authenticateJWT, avatarUpload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Avatar file is required" })
    }
    const avatarPath = `/uploads/${req.file.filename}`
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: avatarPath },
      select: { id: true, email: true, name: true, role: true, phone: true, avatar: true, gender: true }
    })
    res.json({ user: updated })
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to upload avatar" })
  }
})

app.get("/api/user/addresses", authenticateJWT, async (req, res) => {
  try {
    const list = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    })
    res.json(list)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch addresses" })
  }
})

app.post("/api/user/addresses", authenticateJWT, async (req, res) => {
  const data = req.body || {}
  if (!data.name || !data.phone || !data.pincode || !data.address || !data.city || !data.state) {
    return res.status(400).json({ error: "Name, phone, pincode, address, city, and state are required" })
  }
  try {
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id, isDefault: true },
        data: { isDefault: false }
      })
    }
    const created = await prisma.address.create({
      data: {
        name: String(data.name).trim(),
        phone: String(data.phone).trim(),
        pincode: String(data.pincode).trim(),
        locality: data.locality ? String(data.locality).trim() : null,
        address: String(data.address).trim(),
        city: String(data.city).trim(),
        state: String(data.state).trim(),
        landmark: data.landmark ? String(data.landmark).trim() : null,
        altPhone: data.altPhone ? String(data.altPhone).trim() : null,
        addressType: ["Home", "Work"].includes(data.addressType) ? data.addressType : "Home",
        isDefault: !!data.isDefault,
        userId: req.user.id
      }
    })
    res.status(201).json(created)
  } catch (error) {
    res.status(500).json({ error: "Failed to create address" })
  }
})

app.put("/api/user/addresses/:id", authenticateJWT, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid address id" })
  }
  const data = req.body || {}
  try {
    const existing = await prisma.address.findFirst({ where: { id, userId: req.user.id } })
    if (!existing) {
      return res.status(404).json({ error: "Address not found" })
    }
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      })
    }
    const updates = {}
    if (typeof data.name === "string") updates.name = data.name.trim()
    if (typeof data.phone === "string") updates.phone = data.phone.trim()
    if (typeof data.pincode === "string") updates.pincode = data.pincode.trim()
    if (typeof data.locality !== "undefined") updates.locality = data.locality ? String(data.locality).trim() : null
    if (typeof data.address === "string") updates.address = data.address.trim()
    if (typeof data.city === "string") updates.city = data.city.trim()
    if (typeof data.state === "string") updates.state = data.state.trim()
    if (typeof data.landmark !== "undefined") updates.landmark = data.landmark ? String(data.landmark).trim() : null
    if (typeof data.altPhone !== "undefined") updates.altPhone = data.altPhone ? String(data.altPhone).trim() : null
    if (typeof data.addressType === "string" && ["Home", "Work"].includes(data.addressType)) updates.addressType = data.addressType
    if (typeof data.isDefault === "boolean") updates.isDefault = data.isDefault
    const updated = await prisma.address.update({ where: { id }, data: updates })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: "Failed to update address" })
  }
})

app.delete("/api/user/addresses/:id", authenticateJWT, async (req, res) => {
  const id = parseInt(req.params.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid address id" })
  }
  try {
    const existing = await prisma.address.findFirst({ where: { id, userId: req.user.id } })
    if (!existing) {
      return res.status(404).json({ error: "Address not found" })
    }
    await prisma.address.delete({ where: { id } })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to delete address" })
  }
})

// Admin Stats Endpoint
app.get("/api/admin/stats", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const validStatusesForRevenue = { not: "CANCELLED" }
    const revenueOrders = await prisma.order.findMany({
      where: { status: validStatusesForRevenue },
      select: { amount: true, status: true }
    })
    const totalRevenue = revenueOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0)
    const totalOrdersCount = await prisma.order.count()
    const totalProductsCount = await prisma.product.count()
    const totalUsersCount = await prisma.user.count()

    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } }
    })

    const orderItems = await prisma.orderItem.findMany({
      where: { order: { status: validStatusesForRevenue } },
      include: { product: true }
    })
    const categorySalesMap = {}
    orderItems.forEach(item => {
      const category = item.product?.category || "Other"
      const itemRev = (Number(item.price) || 0) * (Number(item.quantity) || 0)
      categorySalesMap[category] = (categorySalesMap[category] || 0) + itemRev
    })
    const categorySales = Object.entries(categorySalesMap).map(([category, value]) => ({
      category,
      value
    }))

    const revenueBreakdown = {
      PAID: 0, PLACED: 0, PENDING: 0, CANCELLED: 0, OTHER: 0
    }
    for (const o of revenueOrders) {
      const s = o.status || "OTHER"
      revenueBreakdown[s in revenueBreakdown ? s : "OTHER"] += Number(o.amount) || 0
    }

    res.json({
      totalRevenue,
      totalOrders: totalOrdersCount,
      totalProducts: totalProductsCount,
      totalUsers: totalUsersCount,
      recentOrders,
      categorySales,
      revenueBreakdown
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin stats" })
  }
})

// Admin Users List Endpoint
app.get("/api/admin/users", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    })
    res.json(users)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" })
  }
})

// Admin Orders List Endpoint
app.get("/api/admin/orders", authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, email: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})

// Admin Order Management API
app.put("/api/admin/orders/:id", authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  if (!status) {
    return res.status(400).json({ error: "Status is required" })
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status },
      include: { items: { include: { product: true } } }
    })
    res.json(updatedOrder)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Order not found" })
    }
    res.status(500).json({ error: "Failed to update order status" })
  }
})

// Product Routes
app.get("/api/products", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: "asc" }
    })
    res.json(products)
  } catch (error) {
    console.error("Products fetch error:", error)
    res.status(500).json({ error: "Failed to fetch products", details: error.message })
  }
})

app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    })
    if (!product) {
      return res.status(404).json({ error: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" })
  }
})

app.post("/api/products", authenticateJWT, requireAdmin, async (req, res) => {
  const { name, price, description, imageUrl, category, stock } = req.body

  if (!name || !price || !description || !category) {
    return res.status(400).json({ error: "Missing required fields: name, price, description, category" })
  }

  try {
    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80",
        category,
        stock: stock ? parseInt(stock) : 10,
      }
    })
    res.status(201).json(newProduct)
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" })
  }
})

app.put("/api/products/:id", authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params
  const { name, price, description, imageUrl, category, stock } = req.body

  try {
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = parseFloat(price)
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (category !== undefined) updateData.category = category
    if (stock !== undefined) updateData.stock = parseInt(stock)

    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: updateData
    })
    res.json(updatedProduct)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Product not found" })
    }
    res.status(500).json({ error: "Failed to update product" })
  }
})

app.delete("/api/products/:id", authenticateJWT, requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    await prisma.product.delete({
      where: { id: parseInt(id) }
    })
    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Product not found" })
    }
    res.status(500).json({ error: "Failed to delete product" })
  }
})

app.get("/api/cart", authenticateJWT, async (req, res) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: true },
      orderBy: { id: "asc" }
    })
    res.json(cartItems)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cart items" })
  }
})

app.post("/api/cart", authenticateJWT, async (req, res) => {
  const { productId } = req.body

  if (!productId) {
    return res.status(400).json({ error: "productId is required" })
  }

  try {
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        productId: parseInt(productId),
        userId: req.user.id
      }
    })

    if (existingItem) {
      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + 1 },
        include: { product: true }
      })
      return res.json(updatedItem)
    }

    const newItem = await prisma.cartItem.create({
      data: {
        productId: parseInt(productId),
        userId: req.user.id,
        quantity: 1
      },
      include: { product: true }
    })
    res.status(201).json(newItem)
  } catch (error) {
    res.status(500).json({ error: "Failed to add item to cart" })
  }
})

app.delete("/api/cart/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params

  try {
    const cartItem = await prisma.cartItem.findFirst({
      where: { id: parseInt(id), userId: req.user.id }
    })
    if (!cartItem) {
      return res.status(404).json({ error: "Cart item not found" })
    }
    await prisma.cartItem.delete({
      where: { id: parseInt(id) }
    })
    res.json({ message: "Item removed from cart" })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Cart item not found" })
    }
    res.status(500).json({ error: "Failed to remove item from cart" })
  }
})

app.put("/api/cart/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params
  const { quantity } = req.body

  if (quantity === undefined) {
    return res.status(400).json({ error: "quantity is required" })
  }

  const parsedQty = parseInt(quantity)

  try {
    const cartItem = await prisma.cartItem.findFirst({
      where: { id: parseInt(id), userId: req.user.id }
    })
    if (!cartItem) {
      return res.status(404).json({ error: "Cart item not found" })
    }

    if (parsedQty <= 0) {
      await prisma.cartItem.delete({
        where: { id: parseInt(id) }
      })
      return res.json({ message: "Item removed from cart (quantity 0)" })
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: parseInt(id) },
      data: { quantity: parsedQty },
      include: { product: true }
    })
    res.json(updatedItem)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Cart item not found" })
    }
    res.status(500).json({ error: "Failed to update cart item quantity" })
  }
})

app.post("/api/payments/create-order", authenticateJWT, async (req, res) => {
  const { name, email, phone, shippingAddress } = req.body

  if (!name || !email || !phone || !shippingAddress) {
    return res.status(400).json({ error: "All customer details are required" })
  }

  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.user.id },
      include: { product: true }
    })

    if (cartItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" })
    }

    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    )
    const tax = subtotal * 0.08
    const totalAmount = subtotal + tax
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `aura_${req.user.id}_${Date.now()}`,
      notes: { userId: String(req.user.id) }
    })

    const order = await prisma.order.create({
      data: {
        amount: totalAmount,
        currency: "INR",
        status: "PENDING",
        paymentStatus: "PENDING",
        razorpayOrderId: razorpayOrder.id,
        userId: req.user.id,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        shippingAddress,
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price
          }))
        }
      },
      include: { items: true }
    })

    res.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      order: {
        ...order,
        items: order.items.map(item => ({
          productId: item.productId,
          name: cartItems.find(cartItem => cartItem.productId === item.productId).product.name,
          quantity: item.quantity,
          price: item.price
        }))
      }
    })
  } catch (error) {
    res.status(500).json({ error: "Failed to place order", details: error.message })
  }
})

app.post("/api/payments/verify", authenticateJWT, async (req, res) => {
  const {
    orderId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature
  } = req.body

  if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ error: "Payment verification details are required" })
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: parseInt(orderId), userId: req.user.id },
      include: { items: { include: { product: true } } }
    })

    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }

    if (order.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({ error: "Payment order does not match" })
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex")

    const signaturesMatch = expectedSignature.length === razorpaySignature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpaySignature))

    if (!signaturesMatch) {
      return res.status(400).json({ error: "Invalid payment signature" })
    }

    if (order.paymentStatus === "CAPTURED") {
      return res.json({ success: true, order })
    }

    const paidOrder = await prisma.$transaction(async tx => {
      for (const item of order.items) {
        const updatedProduct = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        })

        if (updatedProduct.count !== 1) {
          throw new Error("One or more products no longer have sufficient stock")
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paymentStatus: "CAPTURED",
          razorpayPaymentId,
          razorpaySignature
        },
        include: { items: { include: { product: true } } }
      })

      await tx.cartItem.deleteMany({ where: { userId: req.user.id } })
      return updatedOrder
    })

    res.json({ success: true, order: paidOrder })
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to verify payment" })
  }
})

app.get("/api/orders", authenticateJWT, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" }
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" })
  }
})

const PORT = process.env.PORT || 5000

app.listen(PORT)