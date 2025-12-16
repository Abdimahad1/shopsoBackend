import express from "express";
import {
  createDiscount,
  getDiscounts,
  getDiscountById,
  updateDiscount,
  deleteDiscount,
  updateDiscountUsage,
  getDiscountStats,
  validateDiscountCode,
  bulkUpdateStatus,
} from "../../controllers/shop/discountController.js";
import { protect, authorizeRoles } from "../../middleware/authMiddleware.js";
import { uploadDiscountImage } from "../../middleware/shop/discountUploadMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// 📌 PUBLIC: Validate discount code (for checkout)
router.get("/validate/:code", validateDiscountCode);

// 📌 Shop owner routes
router.use(authorizeRoles("shopOwner"));

// 📌 CRUD operations
router.post("/", uploadDiscountImage, createDiscount);
router.get("/", getDiscounts);
router.get("/stats/summary", getDiscountStats);
router.get("/:id", getDiscountById);
router.put("/:id", uploadDiscountImage, updateDiscount);
router.delete("/:id", deleteDiscount);

// 📌 Special operations
router.patch("/:id/use", updateDiscountUsage); // When discount is used in order
router.patch("/bulk/status", bulkUpdateStatus); // Bulk update status

export default router;