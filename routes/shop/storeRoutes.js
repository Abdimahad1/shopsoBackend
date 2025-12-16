import express from "express";
import {
  createStore,
  getMyStore,
  updateStore,
  updateSocialLinks,
  getPublicStore,
  deleteStore,
} from "../../controllers/shop/storeController.js";
import { protect, shopOwnerOnly } from "../../middleware/authMiddleware.js";
import { uploadStoreImages } from "../../middleware/shop/storeUpload.js";

const router = express.Router();

// Public routes
router.get("/public/:userId", getPublicStore);

// Protected routes
router.use(protect);

// Shop owner routes
router.post(
  "/",
  shopOwnerOnly,
  uploadStoreImages,
  createStore
);

router.get(
  "/my-store",
  shopOwnerOnly,
  getMyStore
);

router.put(
  "/my-store",
  shopOwnerOnly,
  uploadStoreImages,
  updateStore
);

// Separate route for updating only social links
router.patch(
  "/my-store/social",
  shopOwnerOnly,
  updateSocialLinks
);

// Delete store
router.delete(
  "/my-store",
  shopOwnerOnly,
  deleteStore
);

export default router;