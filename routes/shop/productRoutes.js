import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateStock,
  getProductStats,
  debugUser, // ADDED
} from "../../controllers/shop/productController.js";
import { protect, authorizeRoles } from "../../middleware/authMiddleware.js"; // REMOVED checkOwnership
import { uploadProductImages } from "../../middleware/shop/uploadMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// 📌 Debug endpoint (temporary - for testing ownership)
router.get("/debug/user", debugUser);

// 📌 Everyone can GET products (filtered by ownership in controller)
router.get("/", getProducts);
router.get("/stats/summary", authorizeRoles("shopOwner"), getProductStats);
router.get("/:id", getProductById);

// 📌 ONLY shopOwner can CREATE products
router.post(
  "/",
  authorizeRoles("shopOwner"),
  uploadProductImages,
  createProduct
);

// 📌 ONLY shopOwner can UPDATE their own products
// Ownership check is handled in the controller
router.put(
  "/:id",
  authorizeRoles("shopOwner"),
  uploadProductImages,
  updateProduct
);

// 📌 ONLY shopOwner can DELETE their own products
// Ownership check is handled in the controller
router.delete(
  "/:id",
  authorizeRoles("shopOwner"),
  deleteProduct
);

// 📌 ONLY shopOwner can update stock of their own products
// Ownership check is handled in the controller
router.patch(
  "/:id/stock",
  authorizeRoles("shopOwner"),
  updateStock
);

export default router;