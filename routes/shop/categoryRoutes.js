import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../../controllers/shop/categoryController.js";
import { protect, authorizeRoles, checkOwnership } from "../../middleware/authMiddleware.js";

const router = express.Router();

// All routes require login
router.use(protect);

// 📌 Everyone can read (filtered by ownership in controller)
router.get("/", getCategories);
router.get("/:id", getCategoryById);

// 📌 Only shopOwner can create, update, delete
router.post("/", authorizeRoles("shopOwner"), createCategory);

// 🔥 ADD ownership check for update and delete
router.put(
  "/:id", 
  authorizeRoles("shopOwner"),
  checkOwnership("Category"), // Check ownership
  updateCategory
);

router.delete(
  "/:id", 
  authorizeRoles("shopOwner"),
  checkOwnership("Category"), // Check ownership
  deleteCategory
);

export default router;