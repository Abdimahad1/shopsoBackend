import Product from "../../models/shop/Product.js";
import Category from "../../models/shop/Category.js";
import { deleteFile } from "../../middleware/shop/uploadMiddleware.js";

// Build correct image URL
const getImageUrl = (req, filename) => {
  if (!filename) return null;
  
  // Debug logging
  console.log("🔗 Generating image URL for:", filename);
  console.log("  Protocol:", req.protocol);
  console.log("  Host:", req.get("host"));
  
  const url = `${req.protocol}://${req.get("host")}/uploads/products/${filename}`;
  console.log("  Full URL:", url);
  
  return url;
};

// Helper function to compare IDs safely
const compareIds = (id1, id2) => {
  if (!id1 || !id2) return false;
  return id1.toString() === id2.toString();
};

/* ============================================================
   CREATE PRODUCT (owner only)
   POST /api/products
============================================================ */
export const createProduct = async (req, res) => {
  try {
    const { name, category, price, stock, description } = req.body;

    if (!name || !category || !price || !stock) {
      return res.status(400).json({
        success: false,
        message: "Name, category, price, and stock are required",
      });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (!req.files || !req.files.frontImage) {
      return res.status(400).json({
        success: false,
        message: "Front image is required",
      });
    }

    const productData = {
      name,
      category,
      price: parseFloat(price),
      stock: parseInt(stock),
      description: description || "",
      frontImage: req.files.frontImage[0].filename,
      createdBy: req.user.id, // OWNER ONLY
    };

    if (req.files.backImage) {
      productData.backImage = req.files.backImage[0].filename;
    }

    const product = await Product.create(productData);
    await product.populate("category", "name");

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        ...product.toObject(),
        frontImage: getImageUrl(req, product.frontImage),
        backImage: product.backImage ? getImageUrl(req, product.backImage) : null,
      },
    });
  } catch (error) {
    console.error("Create Product Error:", error);

    // Clean up uploaded files on error
    if (req.files) {
      if (req.files.frontImage) {
        await deleteFile(req.files.frontImage[0].filename);
      }
      if (req.files.backImage) {
        await deleteFile(req.files.backImage[0].filename);
      }
    }

    res.status(500).json({ 
      success: false, 
      message: "Error creating product", 
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  }
};

/* ============================================================
   GET ALL PRODUCTS (everyone can see)
   GET /api/products
============================================================ */
export const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      lowStock,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {};

    // Filter by shop owner's products
    if (req.user.role === "shopOwner") {
      filter.createdBy = req.user.id;
    }
    // Admin can see all products (no filter)

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category !== "All") {
      if (req.user.role === "shopOwner") {
        const categoryDoc = await Category.findOne({
          name: category,
          createdBy: req.user.id
        });
        if (categoryDoc) filter.category = categoryDoc._id;
      } else {
        const categoryDoc = await Category.findOne({ name: category });
        if (categoryDoc) filter.category = categoryDoc._id;
      }
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (lowStock === "true") filter.stock = { $lte: 5 };

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);

    const productsWithImages = products.map((p) => ({
      ...p.toObject(),
      frontImage: getImageUrl(req, p.frontImage),
      backImage: p.backImage ? getImageUrl(req, p.backImage) : null,
    }));

    res.json({
      success: true,
      data: productsWithImages,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Products Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching products", 
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  }
};

/* ============================================================
   GET SINGLE PRODUCT
   GET /api/products/:id
============================================================ */
export const getProductById = async (req, res) => {
  try {
    console.log("=== GET PRODUCT BY ID ===");
    console.log("Requested product ID:", req.params.id);
    console.log("Current user ID:", req.user.id);
    console.log("Current user role:", req.user.role);

    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("createdBy", "name email");

    if (!product) {
      console.log("❌ Product not found");
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    console.log("Product found. Created by:", product.createdBy);

    // Ownership check for shop owners
    if (req.user.role === "shopOwner") {
      const productOwnerId = product.createdBy._id ? product.createdBy._id.toString() : product.createdBy.toString();
      const currentUserId = req.user.id.toString();
      
      console.log("=== OWNERSHIP VERIFICATION ===");
      console.log("Product Owner ID:", productOwnerId);
      console.log("Current User ID:", currentUserId);
      console.log("IDs Match?", productOwnerId === currentUserId);
      
      if (!compareIds(product.createdBy._id || product.createdBy, req.user.id)) {
        console.log("❌ ACCESS DENIED: Product does not belong to current user");
        return res.status(403).json({ 
          success: false, 
          message: "Access denied. You can only view your own products." 
        });
      }
      
      console.log("✅ ACCESS GRANTED: Product belongs to current user");
    }

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        frontImage: getImageUrl(req, product.frontImage),
        backImage: product.backImage ? getImageUrl(req, product.backImage) : null,
      },
    });
  } catch (error) {
    console.error("Get Product Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching product", 
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  }
};

/* ============================================================
   UPDATE PRODUCT (owner only)
   PUT /api/products/:id
============================================================ */
export const updateProduct = async (req, res) => {
  try {
    console.log("=== UPDATE PRODUCT ===");
    console.log("Product ID:", req.params.id);
    console.log("Current user ID:", req.user.id);
    console.log("Current user role:", req.user.role);

    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log("❌ Product not found");
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    console.log("Product createdBy:", product.createdBy);

    // Owner only check
    if (!compareIds(product.createdBy, req.user.id)) {
      console.log("❌ OWNERSHIP FAILED: Product does not belong to current user");
      return res.status(403).json({
        success: false,
        message: "You do not own this product",
      });
    }

    console.log("✅ Ownership verified. Proceeding with update...");

    const { name, category, price, stock, description } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) return res.status(404).json({ 
        success: false,
        message: "Category not found" 
      });
      updateData.category = category;
    }
    if (price !== undefined) updateData.price = parseFloat(price);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (description !== undefined) updateData.description = description;

    // ✅ FIXED: Use middleware's deleteFile function properly
    if (req.files?.frontImage) {
      await deleteFile(product.frontImage);
      updateData.frontImage = req.files.frontImage[0].filename;
    }

    if (req.files?.backImage) {
      if (product.backImage) {
        await deleteFile(product.backImage);
      }
      updateData.backImage = req.files.backImage[0].filename;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      {
        new: true,
        runValidators: true,
      }
    ).populate("category", "name");

    console.log("✅ Product updated successfully");

    res.json({
      success: true,
      message: "Product updated successfully",
      data: {
        ...updatedProduct.toObject(),
        frontImage: getImageUrl(req, updatedProduct.frontImage),
        backImage: updatedProduct.backImage ? getImageUrl(req, updatedProduct.backImage) : null,
      },
    });
  } catch (error) {
    console.error("Update Product Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating product", 
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  }
};

/* ============================================================
   UPDATE STOCK (owner only)
   PATCH /api/products/:id/stock
============================================================ */
export const updateStock = async (req, res) => {
  try {
    console.log("=== UPDATE STOCK ===");
    const { action, quantity = 1 } = req.body;

    if (!["add", "remove"].includes(action)) {
      return res.status(400).json({ 
        success: false,
        message: "Action must be 'add' or 'remove'" 
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    // Owner only
    if (!compareIds(product.createdBy, req.user.id)) {
      console.log("❌ Stock update denied: Not owner");
      return res.status(403).json({ 
        success: false, 
        message: "You do not own this product" 
      });
    }

    let newStock = product.stock;
    if (action === "add") newStock += parseInt(quantity);
    if (action === "remove") newStock = Math.max(0, newStock - parseInt(quantity));

    product.stock = newStock;
    await product.save();

    console.log("✅ Stock updated:", { 
      id: product._id, 
      name: product.name, 
      stock: product.stock 
    });

    res.json({
      success: true,
      message: "Stock updated successfully",
      data: { 
        id: product._id, 
        name: product.name, 
        stock: product.stock 
      },
    });
  } catch (error) {
    console.error("Update Stock Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating stock",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/* ============================================================
   DELETE PRODUCT (owner only)
   DELETE /api/products/:id
============================================================ */
export const deleteProduct = async (req, res) => {
  try {
    console.log("=== DELETE PRODUCT ===");
    console.log("Product ID to delete:", req.params.id);
    console.log("Current user ID:", req.user.id);

    const product = await Product.findById(req.params.id);
    if (!product) {
      console.log("❌ Product not found");
      return res.status(404).json({ 
        success: false, 
        message: "Product not found" 
      });
    }

    console.log("Product found. Created by:", product.createdBy);

    // Owner only
    if (!compareIds(product.createdBy, req.user.id)) {
      console.log("❌ Delete denied: Not owner");
      return res.status(403).json({ 
        success: false, 
        message: "You do not own this product" 
      });
    }

    console.log("✅ Ownership verified. Deleting product...");

    // ✅ FIXED: Use middleware's deleteFile function properly
    if (product.frontImage) await deleteFile(product.frontImage);
    if (product.backImage) await deleteFile(product.backImage);

    await product.deleteOne();

    console.log("✅ Product deleted successfully");

    res.json({ 
      success: true, 
      message: "Product deleted successfully" 
    });
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error deleting product",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/* ============================================================
   PRODUCT STATS (owner only)
============================================================ */
export const getProductStats = async (req, res) => {
  try {
    console.log("=== GET PRODUCT STATS ===");
    console.log("User ID:", req.user.id);
    console.log("User role:", req.user.role);

    const stats = await Product.aggregate([
      { $match: { createdBy: req.user.id } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStock: { $sum: "$stock" },
          totalValue: { $sum: { $multiply: ["$price", "$stock"] } },
          averagePrice: { $avg: "$price" },
          lowStockItems: { $sum: { $cond: [{ $lte: ["$stock", 5] }, 1, 0] } },
        },
      },
    ]);

    console.log("Stats calculated:", stats[0]);

    res.json({
      success: true,
      data: stats[0] || {
        totalProducts: 0,
        totalStock: 0,
        totalValue: 0,
        averagePrice: 0,
        lowStockItems: 0,
      },
    });
  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching stats",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/* ============================================================
   DEBUG ENDPOINT (temporary - development only)
============================================================ */
export const debugUser = async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({ 
      success: false, 
      message: "Debug endpoint only available in development" 
    });
  }
  
  try {
    console.log("=== DEBUG USER INFO ===");
    console.log("Full user object:", req.user);
    console.log("User ID:", req.user.id);
    console.log("User role:", req.user.role);
    
    const userProducts = await Product.find({ createdBy: req.user.id });
    console.log("User's product count:", userProducts.length);
    
    res.json({
      success: true,
      user: {
        id: req.user.id,
        idString: req.user.id.toString(),
        role: req.user.role,
        email: req.user.email,
        name: req.user.name
      },
      productCount: userProducts.length,
      products: userProducts.map(p => ({ id: p._id, name: p.name }))
    });
  } catch (error) {
    console.error("Debug Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Debug error",
      error: error.message 
    });
  }
};