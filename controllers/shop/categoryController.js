import Category from "../../models/shop/Category.js";
import Product from "../../models/shop/Product.js";

/* ============================================================
   CREATE CATEGORY (owner only)
============================================================ */
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    // 🔥 FIX: Make category name unique per owner, not globally
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      createdBy: req.user.id,
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "You already have a category with this name" });
    }

    const category = await Category.create({
      name: name.trim(),
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    res.status(500).json({ success: false, message: "Error creating category" });
  }
};

/* ============================================================
   GET ALL CATEGORIES (everyone can view)
============================================================ */
export const getCategories = async (req, res) => {
  try {
    const { search } = req.query;

    const filter = {};

    // 🔥 CRITICAL FIX: Shop owners only see their own categories
    if (req.user.role === "shopOwner") {
      filter.createdBy = req.user.id;
    }
    // Admin can see all categories

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(filter)
      .populate("createdBy", "name")
      .sort({ name: 1 });

    const data = await Promise.all(
      categories.map(async (c) => ({
        ...c.toObject(),
        productCount: await Product.countDocuments({ 
          category: c._id,
          // Also filter product count by owner
          ...(req.user.role === "shopOwner" && { createdBy: req.user.id })
        }),
      }))
    );

    res.json({ success: true, data });
  } catch (error) {
    console.error("Get Categories Error:", error);
    res.status(500).json({ success: false, message: "Error fetching categories" });
  }
};

/* ============================================================
   GET CATEGORY BY ID
============================================================ */
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate("createdBy", "name");
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // 🔥 FIX: Verify ownership for shop owners
    if (req.user.role === "shopOwner" && category.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const productCount = await Product.countDocuments({ 
      category: category._id,
      // Filter by owner if shop owner
      ...(req.user.role === "shopOwner" && { createdBy: req.user.id })
    });

    res.json({
      success: true,
      data: { ...category.toObject(), productCount },
    });
  } catch (error) {
    console.error("Get Category Error:", error);
    res.status(500).json({ success: false, message: "Error fetching category" });
  }
};

/* ============================================================
   UPDATE CATEGORY (owner only)
============================================================ */
export const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // OWNER ONLY
    if (category.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "You do not own this category" });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    category.name = name.trim();
    await category.save();

    res.json({ success: true, message: "Category updated", data: category });
  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(500).json({ success: false, message: "Error updating category" });
  }
};

/* ============================================================
   DELETE CATEGORY (owner only)
============================================================ */
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    // OWNER ONLY
    if (category.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "You do not own this category" });
    }

    const productCount = await Product.countDocuments({ category: category._id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. ${productCount} products belong to it.`,
      });
    }

    await category.deleteOne();

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(500).json({ success: false, message: "Error deleting category" });
  }
};
