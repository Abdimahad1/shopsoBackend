import Discount from "../../models/shop/Discount.js";
import Product from "../../models/shop/Product.js";
import Category from "../../models/shop/Category.js";
import { deleteFile, getImageUrl } from "../../middleware/shop/discountUploadMiddleware.js";
import path from "path";

// Helper function to compare IDs safely
const compareIds = (id1, id2) => {
  if (!id1 || !id2) return false;
  return id1.toString() === id2.toString();
};

// Helper to validate dates
const validateDates = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  if (start > end) {
    return "End date must be after start date";
  }
  
  if (end < now) {
    return "End date must be in the future";
  }
  
  return null;
};

// Helper to generate unique discount code
const generateDiscountCode = async (shopOwnerId) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const existing = await Discount.findOne({ 
      code, 
      createdBy: shopOwnerId 
    });
    
    if (!existing) isUnique = true;
  }
  
  return code;
};

/* ============================================================
   CREATE DISCOUNT (owner only)
   POST /api/discounts
============================================================ */
export const createDiscount = async (req, res) => {
  try {
    console.log("=== CREATE DISCOUNT ===");
    const {
      name,
      code,
      description,
      type,
      value,
      minOrder,
      maxDiscount,
      startDate,
      endDate,
      usageLimit,
      customerType,
      appliesTo,
      categories,
      products,
      oneTimeUse,
      combineWithOther,
      excludeSaleItems
    } = req.body;

    // Validate required fields
    if (!name || !type || !value || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Name, type, value, start date, and end date are required",
      });
    }

    // Validate dates
    const dateError = validateDates(startDate, endDate);
    if (dateError) {
      return res.status(400).json({
        success: false,
        message: dateError,
      });
    }

    // Generate code if not provided
    let discountCode = code;
    if (!discountCode) {
      discountCode = await generateDiscountCode(req.user.id);
    } else {
      // Check if code already exists for this shop
      const existing = await Discount.findOne({ 
        code: discountCode.toUpperCase(),
        createdBy: req.user.id 
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Discount code already exists for your shop",
        });
      }
    }

    // Parse arrays if provided
    let categoriesArray = [];
    if (categories) {
      try {
        categoriesArray = JSON.parse(categories);
      } catch (e) {
        categoriesArray = Array.isArray(categories) ? categories : [categories];
      }
    }

    let productsArray = [];
    if (products) {
      try {
        productsArray = JSON.parse(products);
      } catch (e) {
        productsArray = Array.isArray(products) ? products : [products];
      }
    }

    // Build discount data
    const discountData = {
      name,
      code: discountCode.toUpperCase(),
      description: description || "",
      type,
      value: parseFloat(value),
      minOrder: minOrder ? parseFloat(minOrder) : 0,
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      customerType: customerType || "all",
      appliesTo: appliesTo || "all_products",
      categories: categoriesArray,
      products: productsArray,
      oneTimeUse: oneTimeUse === "true" || oneTimeUse === true,
      combineWithOther: combineWithOther !== "false",
      excludeSaleItems: excludeSaleItems === "true" || excludeSaleItems === true,
      createdBy: req.user.id,
    };

    // Add image if uploaded
    if (req.file) {
      discountData.image = req.file.filename;
    }

    console.log("Creating discount with data:", discountData);

    // Create discount
    const discount = await Discount.create(discountData);

    // Populate references
    await discount.populate("categories", "name");
    await discount.populate("products", "name");

    res.status(201).json({
      success: true,
      message: "Discount created successfully",
      data: {
        ...discount.toObject(),
        image: discount.image ? getImageUrl(req, discount.image) : null,
        daysRemaining: discount.daysRemaining,
        usagePercentage: discount.usagePercentage,
        isActive: discount.isActive,
      },
    });
  } catch (error) {
    console.error("Create Discount Error:", error);

    // Clean up uploaded file if error occurs
    if (req.file) {
      deleteFile(req.file.path);
    }

    res.status(500).json({ 
      success: false, 
      message: "Error creating discount", 
      error: error.message 
    });
  }
};

/* ============================================================
   GET ALL DISCOUNTS (owner only)
   GET /api/discounts
============================================================ */
export const getDiscounts = async (req, res) => {
  try {
    const {
      search,
      status,
      type,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { createdBy: req.user.id };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (type && type !== "all") {
      filter.type = type;
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [discounts, total] = await Promise.all([
      Discount.find(filter)
        .populate("categories", "name")
        .populate("products", "name price")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Discount.countDocuments(filter),
    ]);

    const discountsWithUrls = discounts.map((discount) => ({
      ...discount.toObject(),
      image: discount.image ? getImageUrl(req, discount.image) : null,
      daysRemaining: discount.daysRemaining,
      usagePercentage: discount.usagePercentage,
      isActive: discount.isActive,
    }));

    res.json({
      success: true,
      data: discountsWithUrls,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Discounts Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching discounts", 
      error: error.message 
    });
  }
};

/* ============================================================
   GET SINGLE DISCOUNT
   GET /api/discounts/:id
============================================================ */
export const getDiscountById = async (req, res) => {
  try {
    console.log("=== GET DISCOUNT BY ID ===");
    console.log("Discount ID:", req.params.id);
    console.log("User ID:", req.user.id);

    const discount = await Discount.findById(req.params.id)
      .populate("categories", "name")
      .populate("products", "name price")
      .populate("createdBy", "name email");

    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: "Discount not found" 
      });
    }

    // Ownership check for shop owners
    if (req.user.role === "shopOwner") {
      if (!compareIds(discount.createdBy, req.user.id)) {
        return res.status(403).json({ 
          success: false, 
          message: "Access denied. You can only view your own discounts." 
        });
      }
    }

    res.json({
      success: true,
      data: {
        ...discount.toObject(),
        image: discount.image ? getImageUrl(req, discount.image) : null,
        daysRemaining: discount.daysRemaining,
        usagePercentage: discount.usagePercentage,
        isActive: discount.isActive,
      },
    });
  } catch (error) {
    console.error("Get Discount Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching discount", 
      error: error.message 
    });
  }
};

/* ============================================================
   UPDATE DISCOUNT (owner only)
   PUT /api/discounts/:id
============================================================ */
export const updateDiscount = async (req, res) => {
  try {
    console.log("=== UPDATE DISCOUNT ===");
    const discount = await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: "Discount not found" 
      });
    }

    // Ownership check
    if (!compareIds(discount.createdBy, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not own this discount",
      });
    }

    const updateData = { ...req.body };

    // Parse JSON fields if they exist
    if (updateData.categories) {
      try {
        updateData.categories = JSON.parse(updateData.categories);
      } catch (e) {
        updateData.categories = Array.isArray(updateData.categories) 
          ? updateData.categories 
          : [updateData.categories];
      }
    }

    if (updateData.products) {
      try {
        updateData.products = JSON.parse(updateData.products);
      } catch (e) {
        updateData.products = Array.isArray(updateData.products) 
          ? updateData.products 
          : [updateData.products];
      }
    }

    // Convert string booleans
    if (updateData.oneTimeUse !== undefined) {
      updateData.oneTimeUse = updateData.oneTimeUse === "true" || updateData.oneTimeUse === true;
    }

    if (updateData.combineWithOther !== undefined) {
      updateData.combineWithOther = updateData.combineWithOther !== "false";
    }

    if (updateData.excludeSaleItems !== undefined) {
      updateData.excludeSaleItems = updateData.excludeSaleItems === "true" || updateData.excludeSaleItems === true;
    }

    // Convert numeric fields
    if (updateData.value !== undefined) updateData.value = parseFloat(updateData.value);
    if (updateData.minOrder !== undefined) updateData.minOrder = parseFloat(updateData.minOrder);
    if (updateData.maxDiscount !== undefined) updateData.maxDiscount = parseFloat(updateData.maxDiscount);
    if (updateData.usageLimit !== undefined) {
      updateData.usageLimit = updateData.usageLimit ? parseInt(updateData.usageLimit) : null;
    }

    // Convert date fields
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

    // Handle image update
    if (req.file) {
      // Delete old image if exists
      if (discount.image) {
        deleteFile(path.join("uploads/discounts", discount.image));
      }
      updateData.image = req.file.filename;
    }

    // Validate dates if provided
    if (updateData.startDate || updateData.endDate) {
      const start = updateData.startDate || discount.startDate;
      const end = updateData.endDate || discount.endDate;
      const dateError = validateDates(start, end);
      if (dateError) {
        return res.status(400).json({
          success: false,
          message: dateError,
        });
      }
    }

    const updatedDiscount = await Discount.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
    .populate("categories", "name")
    .populate("products", "name price");

    res.json({
      success: true,
      message: "Discount updated successfully",
      data: {
        ...updatedDiscount.toObject(),
        image: updatedDiscount.image ? getImageUrl(req, updatedDiscount.image) : null,
        daysRemaining: updatedDiscount.daysRemaining,
        usagePercentage: updatedDiscount.usagePercentage,
        isActive: updatedDiscount.isActive,
      },
    });
  } catch (error) {
    console.error("Update Discount Error:", error);
    
    // Clean up uploaded file if error occurs
    if (req.file) {
      deleteFile(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Error updating discount", 
      error: error.message 
    });
  }
};

/* ============================================================
   DELETE DISCOUNT (owner only)
   DELETE /api/discounts/:id
============================================================ */
export const deleteDiscount = async (req, res) => {
  try {
    console.log("=== DELETE DISCOUNT ===");
    const discount = await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: "Discount not found" 
      });
    }

    // Ownership check
    if (!compareIds(discount.createdBy, req.user.id)) {
      return res.status(403).json({ 
        success: false, 
        message: "You do not own this discount" 
      });
    }

    // Delete image if exists
    if (discount.image) {
      deleteFile(path.join("uploads/discounts", discount.image));
    }

    await discount.deleteOne();

    res.json({ 
      success: true, 
      message: "Discount deleted successfully" 
    });
  } catch (error) {
    console.error("Delete Discount Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error deleting discount", 
      error: error.message 
    });
  }
};

/* ============================================================
   UPDATE DISCOUNT USAGE (when used in order)
   PATCH /api/discounts/:id/use
============================================================ */
export const updateDiscountUsage = async (req, res) => {
  try {
    console.log("=== UPDATE DISCOUNT USAGE ===");
    const { orderId, orderAmount } = req.body;

    if (!orderId || !orderAmount) {
      return res.status(400).json({
        success: false,
        message: "Order ID and amount are required",
      });
    }

    const discount = await Discount.findById(req.params.id);

    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: "Discount not found" 
      });
    }

    // Check if discount is still valid
    const now = new Date();
    const start = new Date(discount.startDate);
    const end = new Date(discount.endDate);

    if (now < start || now > end || discount.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Discount is not active",
      });
    }

    // Check usage limit
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Discount usage limit reached",
      });
    }

    // Update usage stats
    discount.usedCount += 1;
    discount.ordersUsed += 1;
    discount.revenueGenerated += parseFloat(orderAmount);

    await discount.save();

    res.json({
      success: true,
      message: "Discount usage updated",
      data: {
        id: discount._id,
        code: discount.code,
        usedCount: discount.usedCount,
        remainingUses: discount.remainingUses,
        revenueGenerated: discount.revenueGenerated,
      },
    });
  } catch (error) {
    console.error("Update Discount Usage Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating discount usage", 
      error: error.message 
    });
  }
};

/* ============================================================
   GET DISCOUNT STATS (owner only)
   GET /api/discounts/stats/summary
============================================================ */
export const getDiscountStats = async (req, res) => {
  try {
    console.log("=== GET DISCOUNT STATS ===");

    const stats = await Discount.aggregate([
      { $match: { createdBy: req.user._id } },
      {
        $group: {
          _id: null,
          totalDiscounts: { $sum: 1 },
          activeDiscounts: { 
            $sum: { 
              $cond: [
                { 
                  $and: [
                    { $lte: ["$startDate", new Date()] },
                    { $gte: ["$endDate", new Date()] },
                    { $eq: ["$status", "active"] }
                  ]
                }, 
                1, 
                0 
              ] 
            } 
          },
          upcomingDiscounts: { 
            $sum: { $cond: [{ $eq: ["$status", "upcoming"] }, 1, 0] } 
          },
          expiredDiscounts: { 
            $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] } 
          },
          totalUsage: { $sum: "$usedCount" },
          totalRevenue: { $sum: "$revenueGenerated" },
          totalOrders: { $sum: "$ordersUsed" },
        },
      },
    ]);

    // Calculate active discount percentage
    const total = stats[0]?.totalDiscounts || 0;
    const active = stats[0]?.activeDiscounts || 0;
    const avgUsageRate = total > 0 ? Math.round((active / total) * 100) : 0;

    res.json({
      success: true,
      data: {
        ...(stats[0] || {
          totalDiscounts: 0,
          activeDiscounts: 0,
          upcomingDiscounts: 0,
          expiredDiscounts: 0,
          totalUsage: 0,
          totalRevenue: 0,
          totalOrders: 0,
        }),
        avgUsageRate,
      },
    });
  } catch (error) {
    console.error("Discount Stats Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching discount stats", 
      error: error.message 
    });
  }
};

/* ============================================================
   VALIDATE DISCOUNT CODE (for checkout)
   GET /api/discounts/validate/:code
============================================================ */
export const validateDiscountCode = async (req, res) => {
  try {
    console.log("=== VALIDATE DISCOUNT CODE ===");
    const { code } = req.params;
    const { orderAmount } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Discount code is required",
      });
    }

    const discount = await Discount.findOne({ 
      code: code.toUpperCase(),
      createdBy: req.user.id 
    })
    .populate("categories", "name")
    .populate("products", "name price");

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Discount code not found",
      });
    }

    // Check if discount is active
    const now = new Date();
    const start = new Date(discount.startDate);
    const end = new Date(discount.endDate);

    if (now < start) {
      return res.status(400).json({
        success: false,
        message: "Discount is not active yet",
        data: { startDate: discount.startDate },
      });
    }

    if (now > end) {
      return res.status(400).json({
        success: false,
        message: "Discount has expired",
        data: { endDate: discount.endDate },
      });
    }

    if (discount.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Discount is not active",
      });
    }

    // Check usage limit
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Discount usage limit reached",
      });
    }

    // Check minimum order
    if (orderAmount && discount.minOrder > 0) {
      const orderTotal = parseFloat(orderAmount);
      if (orderTotal < discount.minOrder) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount is $${discount.minOrder}`,
          data: { minOrder: discount.minOrder },
        });
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    let finalAmount = 0;
    
    if (discount.type === "percentage") {
      discountAmount = (parseFloat(orderAmount) * discount.value) / 100;
      if (discount.maxDiscount > 0 && discountAmount > discount.maxDiscount) {
        discountAmount = discount.maxDiscount;
      }
    } else {
      discountAmount = discount.value;
    }

    finalAmount = Math.max(0, parseFloat(orderAmount) - discountAmount);

    res.json({
      success: true,
      message: "Discount code is valid",
      data: {
        discount: {
          ...discount.toObject(),
          image: discount.image ? getImageUrl(req, discount.image) : null,
        },
        discountAmount,
        finalAmount,
      },
    });
  } catch (error) {
    console.error("Validate Discount Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error validating discount code", 
      error: error.message 
    });
  }
};

/* ============================================================
   BULK UPDATE DISCOUNT STATUS (owner only)
   PATCH /api/discounts/bulk/status
============================================================ */
export const bulkUpdateStatus = async (req, res) => {
  try {
    console.log("=== BULK UPDATE DISCOUNT STATUS ===");
    const { discountIds, status } = req.body;

    if (!discountIds || !Array.isArray(discountIds) || discountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Discount IDs array is required",
      });
    }

    if (!["active", "paused", "expired"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // Check ownership of all discounts
    const discounts = await Discount.find({ 
      _id: { $in: discountIds } 
    });

    const notOwned = discounts.filter(
      discount => !compareIds(discount.createdBy, req.user.id)
    );

    if (notOwned.length > 0) {
      return res.status(403).json({
        success: false,
        message: "You do not own some of these discounts",
        data: { notOwned: notOwned.map(d => d._id) },
      });
    }

    // Update status
    const result = await Discount.updateMany(
      { _id: { $in: discountIds } },
      { $set: { status } }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} discount(s) status to ${status}`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    console.error("Bulk Update Status Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error updating discount status", 
      error: error.message 
    });
  }
};